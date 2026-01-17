"""
Inference module for misinformation detection and bias analysis.

This module handles model loading, prediction, trust score calculation,
bias detection, and suspicious text highlighting.
"""

import os
import sys
import re
import joblib
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Iterator
from functools import lru_cache
import logging
import json
import asyncio

# Add src to path for imports
sys.path.append(os.path.dirname(__file__))
from preprocessing import prepare_for_model
from gemini_explainer import GeminiExplainer
from cache import get_cache
from bias_data import get_bias_from_url
from fact_checker import get_fact_checker

logger = logging.getLogger(__name__)

class MisinfoPredictor:
    """Handles model inference and prediction for misinformation detection."""
    
    def __init__(self, model_path: str = "models/misinfo_model.pkl"):
        """
        Initialize the predictor and load the trained model.
        
        Args:
            model_path: Path to the saved model file
        """
        self.model_path = Path(model_path)
        self.vectorizer = None
        self.classifier = None
        try:
            self.load_model()
        except Exception as e:
            logger.warning(f"Could not load ML model: {e}. Running in Gemini-only mode.")
        
    def load_model(self):
        """Load the trained model and vectorizer from disk."""
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Model not found at {self.model_path}. "
                "Please train the model first using src/training.py"
            )
        
        print(f"Loading model from {self.model_path}...")
        model_data = joblib.load(self.model_path)
        
        self.vectorizer = model_data['vectorizer']
        self.classifier = model_data['classifier']
        
        print("Model loaded successfully!")
    
    def predict_misinformation(self, text: str, title: Optional[str] = None) -> Dict:
        """
        Predict whether the text contains misinformation.
        
        Args:
            text: Article text to analyze
            title: Optional article title
            
        Returns:
            Dictionary containing trust_score, label, and probabilities
        """
        if not self.classifier or not self.vectorizer:
            return {
                'trust_score': 50,
                'label': "Unknown",
                'confidence': 0.0,
                'prediction': 0
            }

        # Preprocess text
        processed_text = prepare_for_model(text, title)
        
        # Transform to TF-IDF features
        tfidf_features = self.vectorizer.transform([processed_text])
        
        # Get prediction and probability
        prediction = self.classifier.predict(tfidf_features)[0]
        
        # Get decision function scores (confidence)
        decision_score = self.classifier.decision_function(tfidf_features)[0]
        
        # Convert to probability-like score (0-1)
        # PassiveAggressiveClassifier doesn't have predict_proba, so we use decision_function
        # Apply calibrated sigmoid with temperature scaling to reduce sensitivity
        # Temperature > 1 makes the model less confident (smoother probabilities)
        temperature = 2.5  # Higher temperature = less extreme predictions
        scaled_score = np.clip(decision_score / temperature, -20, 20)
        probability = 1 / (1 + np.exp(-scaled_score))
        
        # Calculate trust score (0-100) with calibration
        # Apply additional smoothing to avoid extreme scores like 0% or 100%
        # Map to range [15, 85] to acknowledge uncertainty in all predictions
        if prediction == 1:
            # For "Real" predictions, map probability to 50-85 range
            raw_score = probability * 100
            trust_score = int(50 + (raw_score - 50) * 0.7)
        else:
            # For "Fake" predictions, map to 15-50 range
            raw_score = (1 - probability) * 100
            trust_score = int(15 + (raw_score - 15) * 0.7)
        
        # Ensure score stays within bounds
        trust_score = max(15, min(85, trust_score))
        
        # Determine label based on trust score
        # Adjusted thresholds for new calibrated scoring range (15-85)
        if trust_score >= 65:
            label = "Likely True"
        elif trust_score >= 35:
            label = "Suspicious"
        else:
            label = "Likely Fake"
        
        return {
            'trust_score': trust_score,
            'label': label,
            'confidence': float(probability),
            'prediction': int(prediction)
        }
    
    def get_suspicious_snippets(self, text: str, title: Optional[str] = None, top_n: int = 5) -> List[Dict]:
        """
        Identify and extract suspicious text snippets based on model features.
        
        Args:
            text: Article text to analyze
            title: Optional article title
            top_n: Number of top suspicious snippets to return
            
        Returns:
            List of dictionaries containing flagged snippets with indices and reasons
        """
        if not self.classifier or not self.vectorizer:
            return []

        processed_text = prepare_for_model(text, title)
        tfidf_features = self.vectorizer.transform([processed_text])
        
        # Get feature importance from model coefficients
        feature_scores = self.classifier.coef_[0]
        
        # Get feature names (words/ngrams)
        feature_names = self.vectorizer.get_feature_names_out()
        
        # Get non-zero features for this document
        non_zero_indices = tfidf_features.nonzero()[1]
        
        # Create list of (feature_name, importance_score, tfidf_value)
        feature_importance = []
        for idx in non_zero_indices:
            feature_name = feature_names[idx]
            importance = abs(feature_scores[idx])  # Higher magnitude = more important
            tfidf_value = tfidf_features[0, idx]
            
            # Calculate combined score (importance * presence in document)
            combined_score = importance * tfidf_value
            
            # Only consider features that indicate fake news (negative coefficients)
            if feature_scores[idx] < 0:  # Negative = indicates fake
                feature_importance.append((feature_name, combined_score))
        
        # Sort by combined score
        feature_importance.sort(key=lambda x: x[1], reverse=True)
        
        # Get top N suspicious features
        top_features = feature_importance[:top_n * 3]  # Get more than needed for better matching
        
        # Find these features in the original text
        snippets = []
        original_text_lower = text.lower()
        
        for feature_name, score in top_features:
            if len(snippets) >= top_n:
                break
            
            # Handle multi-word features (ngrams)
            search_pattern = feature_name.replace(' ', r'\s+')
            
            # Find all matches in the original text
            for match in re.finditer(search_pattern, original_text_lower):
                if len(snippets) >= top_n:
                    break
                
                start_idx = match.start()
                end_idx = match.end()
                
                # Get the actual text from original (preserving case)
                matched_text = text[start_idx:end_idx]
                
                # Expand context slightly for better readability
                context_start = max(0, start_idx - 20)
                context_end = min(len(text), end_idx + 20)
                context = text[context_start:context_end].strip()
                
                # Determine reason based on feature characteristics
                reason = self._determine_snippet_reason(feature_name, score)
                
                # Avoid duplicates
                if not any(s['start'] == start_idx and s['end'] == end_idx for s in snippets):
                    snippets.append({
                        'text': matched_text,
                        'start': start_idx,
                        'end': end_idx,
                        'context': context,
                        'reason': reason,
                        'confidence': min(float(score * 10), 1.0)  # Normalize to 0-1
                    })
        
        return snippets
    
    def _determine_snippet_reason(self, feature: str, score: float) -> str:
        """
        Determine the reason why a snippet is flagged.
        """
        # Sensationalist words
        sensationalist = ['shocking', 'amazing', 'unbelievable', 'incredible', 'miracle', 
                         'secret', 'exposed', 'revealed', 'bombshell']
        
        # Emotional manipulation
        emotional = ['hate', 'love', 'fear', 'angry', 'outrage', 'furious', 'devastating']
        
        # Absolute claims
        absolute = ['always', 'never', 'everyone', 'nobody', 'all', 'none', 'every']
        
        # Check feature against categories
        feature_lower = feature.lower()
        
        if any(word in feature_lower for word in sensationalist):
            return "Sensationalist language"
        elif any(word in feature_lower for word in emotional):
            return "Emotional manipulation"
        elif any(word in feature_lower for word in absolute):
            return "Absolute claim without nuance"
        elif len(feature.split()) > 1:
            return "Suspicious phrase pattern"
        else:
            return "Commonly found in misinformation"


class BiasDetector:
    """Detects political bias in text using keyword analysis. (Legacy/Fallback)"""
    
    def __init__(self):
        """Initialize bias detector with keyword dictionaries."""
        # Left-leaning keywords
        self.left_keywords = {
            'progressive', 'liberal', 'socialism', 'social justice', 'equality',
            'climate change', 'healthcare for all', 'workers rights', 'union',
            'diversity', 'inclusion', 'equity', 'minimum wage', 'regulation'
        }
        
        # Right-leaning keywords
        self.right_keywords = {
            'conservative', 'tradition', 'capitalism', 'free market', 'liberty',
            'small government', 'deregulation', 'second amendment', 'patriot',
            'family values', 'law and order', 'border security', 'tax cuts'
        }
        
        # Extreme keywords (both sides)
        self.extreme_keywords = {
            'communist', 'fascist', 'socialist', 'tyranny', 'dictator',
            'destroy', 'attack on', 'war on', 'fake news', 'mainstream media'
        }
    
    def detect_bias(self, text: str) -> str:
        """
        Detect political bias in text.
        """
        text_lower = text.lower()
        
        # Count keyword occurrences
        left_count = sum(1 for keyword in self.left_keywords if keyword in text_lower)
        right_count = sum(1 for keyword in self.right_keywords if keyword in text_lower)
        extreme_count = sum(1 for keyword in self.extreme_keywords if keyword in text_lower)
        
        # Calculate bias score (-1 to 1, negative = left, positive = right)
        total_keywords = left_count + right_count
        
        if total_keywords == 0:
            return "Center"
        
        bias_score = (right_count - left_count) / total_keywords
        
        # Adjust for extreme language (indicates stronger bias)
        if extreme_count > 2:
            bias_score *= 1.5
        
        # Classify bias
        if bias_score < -0.4:
            return "Left"
        elif bias_score < -0.1:
            return "Left-Center"
        elif bias_score > 0.4:
            return "Right"
        elif bias_score > 0.1:
            return "Right-Center"
        else:
            return "Center"


@lru_cache(maxsize=1)
def get_misinfo_predictor() -> MisinfoPredictor:
    """Return a cached predictor instance to avoid reloading the model."""
    return MisinfoPredictor()


@lru_cache(maxsize=1)
def get_bias_detector() -> BiasDetector:
    """Return a cached bias detector instance."""
    return BiasDetector()


@lru_cache(maxsize=1)
def get_gemini_explainer() -> GeminiExplainer:
    """Return a cached Gemini explainer instance."""
    return GeminiExplainer()


def predict_full_analysis(
    text: str, 
    title: Optional[str] = None,
    url: Optional[str] = None,
    force_refresh: bool = False
) -> Dict:
    """
    Perform complete analysis: misinformation detection, bias detection, and highlighting.
    
    Args:
        text: Article text
        title: Optional article title
        url: Optional article URL (for database lookup)
        force_refresh: Whether to ignore cache and force new analysis
        
    Returns:
        Complete analysis dictionary ready for API response
    """
    cache = get_cache()
    
    # Check cache first
    if not force_refresh:
        cached_result = cache.get(url or title or "", text)
        if cached_result:
            logger.info("Returning cached analysis")
            return cached_result

    # Initialize predictors (cached to avoid reloading the model each call)
    misinfo_predictor = get_misinfo_predictor()
    bias_detector = get_bias_detector()
    gemini_explainer = get_gemini_explainer()
    
    # 0. Determine Bias (Database -> Gemini -> Legacy)
    db_bias = get_bias_from_url(url)
    
    # 1. Try Gemini Analysis (Primary)
    gemini_result = gemini_explainer.analyze_content(text, title)

    if gemini_result["trust_score"] != 50 or gemini_result["label"] != "Unknown":
        # Gemini succeeded
        final_bias = db_bias if db_bias else gemini_result['bias']

        # 2. External Fact-Checking for Verifiable Claims
        fact_checked_claims = []
        verifiable_claims = gemini_result.get('verifiable_claims', [])

        if verifiable_claims:
            logger.info(f"Found {len(verifiable_claims)} verifiable claims, checking with external APIs...")
            try:
                fact_checker = get_fact_checker()
                fact_check_results = fact_checker.check_claims(verifiable_claims, max_results_per_claim=1)

                # Convert FactCheckResult objects to dictionaries
                for fc_result in fact_check_results:
                    fact_checked_claims.append({
                        'claim': fc_result.claim,
                        'status': fc_result.status,
                        'explanation': fc_result.explanation,
                        'sources': fc_result.sources,
                        'confidence': fc_result.confidence
                    })

                logger.info(f"Completed fact-checking: {len(fact_checked_claims)} claims verified")
            except Exception as e:
                logger.error(f"Fact-checking failed: {e}")
                # Continue without fact-checking if it fails

        # 3. Sort flagged snippets by their location in the text (by index)
        flagged_snippets = gemini_result.get('flagged_snippets', [])
        flagged_snippets.sort(key=lambda s: s.get('index', [float('inf')])[0] if s.get('index') else float('inf'))

        result = {
            'trust_score': gemini_result['trust_score'],
            'label': gemini_result['label'],
            'bias': final_bias,
            'explanation': {
                'summary': gemini_result.get('summary', 'Analysis by Gemini'),
                'generated_by': 'gemini'
            },
            'flagged_snippets': gemini_result.get('flagged_snippets', []),
            'fact_checked_claims': fact_checked_claims if fact_checked_claims else None,
            'metadata': {
                'model': 'gemini-3-flash-preview',
                'source': 'ai_generated',
                'bias_source': 'database' if db_bias else 'ai_generated',
                'fact_checks_performed': len(fact_checked_claims)
            }
        }

        # Save to cache
        cache.set(url or title or "", text, result)
        return result

    # 2. Fallback to Legacy ML Model if Gemini fails
    logger.info("Gemini analysis unavailable, falling back to ML model")
    
    # Get misinformation prediction
    misinfo_result = misinfo_predictor.predict_misinformation(text, title)
    
    # Get bias detection (fallback)
    legacy_bias = bias_detector.detect_bias(text)
    final_bias = db_bias if db_bias else legacy_bias
    
    # Get snippets (filtering out short garbage)
    snippets = misinfo_predictor.get_suspicious_snippets(text, title, top_n=5)
    flagged_snippets = []
    for snippet in snippets:
        # Filter out very short or single-word snippets that look like noise (e.g. "max")
        if len(snippet['text']) < 10 or len(snippet['text'].split()) < 3:
            continue
            
        flagged_snippets.append({
            'text': snippet['text'],
            'index': [snippet['start'], snippet['end']],
            'type': 'MISINFORMATION', 
            'reason': snippet['reason'],
            'confidence': snippet['confidence'],
            'severity': 'medium' # Default severity for ML
        })
    
    result = {
        'trust_score': misinfo_result['trust_score'],
        'label': misinfo_result['label'],
        'bias': final_bias,
        'explanation': {
            'summary': f"This content was flagged as {misinfo_result['label']} based on linguistic patterns commonly found in misinformation.",
            'generated_by': 'rule-based'
        },
        'flagged_snippets': flagged_snippets,
        'fact_checked_claims': None,
        'metadata': {
            'model_confidence': misinfo_result['confidence'],
            'prediction': misinfo_result['prediction'],
            'bias_source': 'database' if db_bias else 'rule_based'
        }
    }
    
    # Save to cache even for fallback? Yes.
    cache.set(url or title or "", text, result)

    return result


async def predict_full_analysis_streaming(
    text: str,
    title: Optional[str] = None,
    url: Optional[str] = None,
    force_refresh: bool = False
) -> Iterator[str]:
    """
    Stream analysis results incrementally as they become available.

    Yields SSE-formatted strings with partial results.

    Args:
        text: Article text
        title: Optional article title
        url: Optional article URL
        force_refresh: Whether to ignore cache

    Yields:
        SSE-formatted strings with partial analysis data
    """
    # Yield initial status
    yield f"data: {json.dumps({'type': 'status', 'message': 'Starting analysis...', 'progress': 0})}\n\n"

    cache = get_cache()

    # Check cache first
    if not force_refresh:
        cached_result = cache.get(url or title or "", text)
        if cached_result:
            yield f"data: {json.dumps({'type': 'complete', 'result': cached_result})}\n\n"
            return

    # Initialize predictors
    yield f"data: {json.dumps({'type': 'status', 'message': 'Loading AI models...', 'progress': 10})}\n\n"

    misinfo_predictor = get_misinfo_predictor()
    bias_detector = get_bias_detector()
    gemini_explainer = get_gemini_explainer()

    # Determine bias
    yield f"data: {json.dumps({'type': 'status', 'message': 'Analyzing political bias...', 'progress': 20})}\n\n"

    db_bias = get_bias_from_url(url)

    # Try Gemini Analysis
    yield f"data: {json.dumps({'type': 'status', 'message': 'AI analyzing content for misinformation...', 'progress': 30})}\n\n"

    gemini_result = gemini_explainer.analyze_content(text, title)

    if gemini_result["trust_score"] != 50 or gemini_result["label"] != "Unknown":
        # Gemini succeeded
        final_bias = db_bias if db_bias else gemini_result['bias']

        # Yield initial results (basic analysis)
        yield f"data: {json.dumps({'type': 'partial', 'trust_score': gemini_result['trust_score'], 'label': gemini_result['label'], 'bias': final_bias, 'progress': 50})}\n\n"

        # Sort and yield snippets incrementally
        yield f"data: {json.dumps({'type': 'status', 'message': 'Finding flagged content...', 'progress': 60})}\n\n"

        flagged_snippets = gemini_result.get('flagged_snippets', [])
        flagged_snippets.sort(key=lambda s: s.get('index', [float('inf')])[0] if s.get('index') else float('inf'))

        # Yield snippets as they're processed
        for i, snippet in enumerate(flagged_snippets):
            progress = 60 + (i + 1) / len(flagged_snippets) * 20  # 60-80% progress
            yield f"data: {json.dumps({'type': 'snippet', 'snippet': snippet, 'progress': progress})}\n\n"
            # Small delay to simulate processing and make streaming visible
            await asyncio.sleep(0.1)

        # Fact-check claims
        fact_checked_claims = []
        verifiable_claims = gemini_result.get('verifiable_claims', [])

        if verifiable_claims:
            yield f"data: {json.dumps({'type': 'status', 'message': f'Fact-checking {len(verifiable_claims)} claims...', 'progress': 80})}\n\n"

            try:
                fact_checker = get_fact_checker()
                fact_check_results = fact_checker.check_claims(verifiable_claims, max_results_per_claim=1)

                for fc_result in fact_check_results:
                    fact_checked_claims.append({
                        'claim': fc_result.claim,
                        'status': fc_result.status,
                        'explanation': fc_result.explanation,
                        'sources': fc_result.sources,
                        'confidence': fc_result.confidence
                    })
            except Exception as e:
                logger.error(f"Fact-checking failed: {e}")

        # Complete result
        result = {
            'trust_score': gemini_result['trust_score'],
            'label': gemini_result['label'],
            'bias': final_bias,
            'explanation': {
                'summary': gemini_result.get('summary', 'Analysis by Gemini'),
                'generated_by': 'gemini'
            },
            'flagged_snippets': flagged_snippets,
            'fact_checked_claims': fact_checked_claims if fact_checked_claims else None,
            'metadata': {
                'model': 'gemini-3-flash-preview',
                'source': 'ai_generated',
                'bias_source': 'database' if db_bias else 'ai_generated',
                'fact_checks_performed': len(fact_checked_claims)
            }
        }

        # Cache result
        cache.set(url or title or "", text, result)

        # Yield complete signal
        yield f"data: {json.dumps({'type': 'complete', 'result': result, 'progress': 100})}\n\n"

    else:
        # Gemini failed, use fallback (simplified for streaming)
        yield f"data: {json.dumps({'type': 'status', 'message': 'Using fallback analysis...', 'progress': 90})}\n\n"

        # Call non-streaming version for fallback
        result = predict_full_analysis(text, title, url, force_refresh)
        yield f"data: {json.dumps({'type': 'complete', 'result': result, 'progress': 100})}\n\n"
