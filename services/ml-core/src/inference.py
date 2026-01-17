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
import datetime

# Add src to path for imports
sys.path.append(os.path.dirname(__file__))
from preprocessing import prepare_for_model
from gemini_explainer import GeminiExplainer
from cache import get_cache
from bias_data import get_bias_from_url
from fact_checker import get_fact_checker
from claim_validator import get_claim_validator
from web_search import get_web_search

logger = logging.getLogger(__name__)

class TriageAgent:
    """Determines if a claim requires historical fact-checking or breaking news verification."""
    
    def classify_claim_type(self, claim: str) -> str:
        """
        Classify a claim as 'BREAKING_NEWS' or 'HISTORICAL_FACT'.
        
        Args:
            claim: The claim text
            
        Returns:
            String classification
        """
        # Check for recent indicators
        recent_keywords = [
            'today', 'yesterday', 'this week', 'breaking', 'just now', 
            'live', 'update', 'current', 'latest', 'recently', 'new', 'report'
        ]
        
        claim_lower = claim.lower()
        # Word boundary check for keywords to avoid partial matches
        for kw in recent_keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', claim_lower):
                return "BREAKING_NEWS"
        
        # Check for recent years (current year and last year)
        # Assuming current context is 2026 based on user info
        try:
            current_year = datetime.datetime.now().year
            recent_years = [str(current_year), str(current_year - 1)]
            
            if any(year in claim for year in recent_years):
                return "BREAKING_NEWS"
        except:
            pass
            
        return "HISTORICAL_FACT"

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
    force_refresh: bool = False,
    article_date: Optional[str] = None
) -> Dict:
    """
    Perform complete analysis: misinformation detection, bias detection, and highlighting.

    Args:
        text: Article text
        title: Optional article title
        url: Optional article URL (for database lookup)
        force_refresh: Whether to ignore cache and force new analysis
        article_date: Optional article publication date (ISO format or common date string)

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

        # 2. Hybrid Fact-Checking Pipeline
        fact_checked_claims = []
        verifiable_claims = gemini_result.get('verifiable_claims', [])

        if verifiable_claims:
            logger.info(f"Found {len(verifiable_claims)} verifiable claims, starting hybrid verification...")
            try:
                fact_checker = get_fact_checker()
                web_search = get_web_search()
                triage_agent = TriageAgent()
                
                for claim in verifiable_claims:
                    # Triage: Breaking vs Historical
                    claim_type = triage_agent.classify_claim_type(claim)
                    
                    if claim_type == "BREAKING_NEWS":
                        # Breaking News Route
                        logger.info(f"Claim classified as BREAKING NEWS: '{claim}'")
                        news_results = web_search.search_consensus(claim)
                        credibility_score = web_search.calculate_credibility_score(news_results)
                        
                        # Apply consensus logic
                        status = "Unverified"
                        explanation = "No trusted news sources found reporting this."
                        confidence = 0.5
                        
                        if credibility_score > 0.8:
                            status = "Verified"
                            explanation = "Confirmed by multiple trusted news outlets."
                            confidence = credibility_score
                        elif credibility_score < 0.2:
                            # If no trusted sources report a "breaking" event, it's likely unsubstantiated
                            # Double check with a general search to see if it's just obscure
                            general_results = web_search.search_for_verification(claim, num_results=3, recent_only=True)
                            if not general_results:
                                status = "Unsubstantiated"
                                explanation = "No trusted sources are reporting this event."
                                confidence = 0.9
                            else:
                                status = "Unsubstantiated"
                                explanation = "Reported only by unverified sources; pending trusted confirmation."
                                confidence = 0.6
                        else:
                            status = "Mixed"
                            explanation = "Mixed reporting or single source confirmation."
                            confidence = 0.5
                            
                        fact_checked_claims.append({
                            'claim': claim,
                            'status': status,
                            'explanation': explanation,
                            'sources': [r['url'] for r in news_results[:3]],
                            'confidence': confidence,
                            'type': 'breaking_news'
                        })
                        
                    else:
                        # Historical Fact Route
                        logger.info(f"Claim classified as HISTORICAL: '{claim}'")
                        fc_results = fact_checker.check_claims([claim], max_results_per_claim=1)
                        if fc_results:
                            fc_result = fc_results[0]
                            fact_checked_claims.append({
                                'claim': fc_result.claim,
                                'status': fc_result.status,
                                'explanation': fc_result.explanation,
                                'sources': fc_result.sources,
                                'confidence': fc_result.confidence,
                                'type': 'historical_fact'
                            })

                logger.info(f"Completed hybrid verification: {len(fact_checked_claims)} claims checked")
            except Exception as e:
                logger.error(f"Hybrid verification failed: {e}")

        # 3. Validate flagged snippets to ensure negative assertions have sources
        logger.info("Validating flagged snippets for negative assertions...")
        claim_validator = get_claim_validator()

        # Build preliminary result for validation
        preliminary_result = {
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

        # Validate and enrich snippets
        # Control via env var: REQUIRE_SOURCES_FOR_NEGATIVE_CLAIMS (default: true)
        require_sources = os.getenv('REQUIRE_SOURCES_FOR_NEGATIVE_CLAIMS', 'true').lower() == 'true'
        result = claim_validator.validate_analysis_result(
            preliminary_result,
            require_sources=require_sources,
            article_date=article_date
        )

        # 4. Sort flagged snippets by their location in the text (by index)
        flagged_snippets = result.get('flagged_snippets', [])
        flagged_snippets.sort(key=lambda s: s.get('index', [float('inf')])[0] if s.get('index') else float('inf'))
        result['flagged_snippets'] = flagged_snippets
        
        # 5. Pipeline Aggregation Logic (Refine Trust Score based on verification)
        # Differentiate between direct misinformation (harsh) and unsubstantiated claims (warnings)
        # Also differentiate between article's own claims vs quoted claims
        if fact_checked_claims:
            # Separate claims by severity
            false_claims = [c for c in fact_checked_claims if c['status'] == 'False']
            misleading_claims = [c for c in fact_checked_claims if c['status'] == 'Misleading']
            unsubstantiated_claims = [c for c in fact_checked_claims if c['status'] == 'Unsubstantiated']
            verified_claims = [c for c in fact_checked_claims if c['status'] == 'Verified']

            # Check if problematic claims come from quotes vs article content
            # Count non-quoted snippets with issues
            non_quoted_snippets = [s for s in flagged_snippets if not s.get('is_quote', False)]
            non_quoted_misinfo = [s for s in non_quoted_snippets if 'misinformation' in s.get('type', '').lower() or 'disinformation' in s.get('type', '').lower()]

            # Apply penalties based on severity - but reduce penalties if issues are mostly in quotes
            quote_ratio = 1 - (len(non_quoted_snippets) / max(len(flagged_snippets), 1))
            penalty_multiplier = 1.0 if quote_ratio < 0.3 else (1.0 - quote_ratio * 0.5)  # Reduce penalties if 30%+ are quotes

            if false_claims:
                # Direct misinformation - harsh penalty (but less harsh if in quotes)
                penalty = int(25 * penalty_multiplier) if penalty_multiplier < 1.0 else 25
                logger.info(f"MAJOR: Downgrading score due to {len(false_claims)} proven false claims (penalty_multiplier: {penalty_multiplier:.2f})")
                result['trust_score'] = min(result['trust_score'], max(penalty, 35))  # Cap at 25-35 depending on quote ratio
                result['label'] = "Likely Fake" if penalty_multiplier > 0.7 else "Suspicious"

                if len(non_quoted_misinfo) > 0:
                    result['explanation']['summary'] += f" Contains {len(false_claims)} proven false claim(s)."
                else:
                    result['explanation']['summary'] += f" Contains {len(false_claims)} false claim(s) in quoted statements."
            elif misleading_claims:
                # Misleading information - moderate penalty
                penalty = int(15 * penalty_multiplier) if penalty_multiplier < 1.0 else 15
                logger.info(f"MODERATE: Downgrading score due to {len(misleading_claims)} misleading claims (penalty: {penalty})")
                result['trust_score'] = max(15, result['trust_score'] - (len(misleading_claims) * penalty))
                if result['trust_score'] < 50:
                    result['label'] = "Suspicious"

                if len(non_quoted_misinfo) > 0:
                    result['explanation']['summary'] += f" Contains {len(misleading_claims)} misleading claim(s)."
                else:
                    result['explanation']['summary'] += f" Contains {len(misleading_claims)} misleading claim(s) in quoted statements."
            elif unsubstantiated_claims:
                # Unsubstantiated - minor penalty (warning)
                penalty = int(8 * penalty_multiplier) if penalty_multiplier < 1.0 else 8
                logger.info(f"MINOR: Warning due to {len(unsubstantiated_claims)} unsubstantiated claims (penalty: {penalty})")
                result['trust_score'] = max(30, result['trust_score'] - (len(unsubstantiated_claims) * penalty))
                if result['trust_score'] < 65:
                    result['label'] = "Suspicious"

                if len(non_quoted_misinfo) > 0:
                    result['explanation']['summary'] += f" Warning: {len(unsubstantiated_claims)} claim(s) could not be verified."
                else:
                    result['explanation']['summary'] += f" Warning: {len(unsubstantiated_claims)} claim(s) in quotes could not be verified."
            elif verified_claims and len(verified_claims) >= len(fact_checked_claims) / 2:
                # Boost confidence if many claims are verified
                logger.info("Boosting score due to verified claims")
                # Only boost if it wasn't already low
                if result['trust_score'] > 40:
                    result['trust_score'] = max(result['trust_score'], 80)
                    result['label'] = "Likely True"

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
    force_refresh: bool = False,
    article_date: Optional[str] = None
) -> Iterator[str]:
    """
    Stream analysis results incrementally as they become available.

    Yields SSE-formatted strings with partial results.

    Args:
        text: Article text
        title: Optional article title
        url: Optional article URL
        force_refresh: Whether to ignore cache
        article_date: Optional article publication date

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

        # Hybrid Fact-Checking Pipeline
        fact_checked_claims = []
        verifiable_claims = gemini_result.get('verifiable_claims', [])

        if verifiable_claims:
            yield f"data: {json.dumps({'type': 'status', 'message': f'Verifying {len(verifiable_claims)} claims (Hybrid Mode)...', 'progress': 80})}\n\n"

            try:
                fact_checker = get_fact_checker()
                web_search = get_web_search()
                triage_agent = TriageAgent()
                
                for claim in verifiable_claims:
                    # Triage: Breaking vs Historical
                    claim_type = triage_agent.classify_claim_type(claim)
                    
                    if claim_type == "BREAKING_NEWS":
                        # Breaking News Route
                        news_results = web_search.search_consensus(claim)
                        credibility_score = web_search.calculate_credibility_score(news_results)
                        
                        # Apply consensus logic
                        status = "Unverified"
                        explanation = "No trusted news sources found reporting this."
                        confidence = 0.5
                        
                        if credibility_score > 0.8:
                            status = "Verified"
                            explanation = "Confirmed by multiple trusted news outlets."
                            confidence = credibility_score
                        elif credibility_score < 0.2:
                            # Double check with general search
                            general_results = web_search.search_for_verification(claim, num_results=3, recent_only=True)
                            if not general_results:
                                status = "Unsubstantiated"
                                explanation = "No trusted sources are reporting this event."
                                confidence = 0.9
                            else:
                                status = "Unsubstantiated"
                                explanation = "Reported only by unverified sources; pending trusted confirmation."
                                confidence = 0.6
                        else:
                            status = "Mixed"
                            explanation = "Mixed reporting or single source confirmation."
                            confidence = 0.5
                            
                        fact_checked_claims.append({
                            'claim': claim,
                            'status': status,
                            'explanation': explanation,
                            'sources': [r['url'] for r in news_results[:3]],
                            'confidence': confidence,
                            'type': 'breaking_news'
                        })
                    else:
                        # Historical Fact Route
                        fc_results = fact_checker.check_claims([claim], max_results_per_claim=1)
                        if fc_results:
                            fc_result = fc_results[0]
                            fact_checked_claims.append({
                                'claim': fc_result.claim,
                                'status': fc_result.status,
                                'explanation': fc_result.explanation,
                                'sources': fc_result.sources,
                                'confidence': fc_result.confidence,
                                'type': 'historical_fact'
                            })
                            
            except Exception as e:
                logger.error(f"Hybrid verification failed: {e}")

        # Validate flagged snippets
        yield f"data: {json.dumps({'type': 'status', 'message': 'Validating claims for sources...', 'progress': 90})}\n\n"

        claim_validator = get_claim_validator()

        # Build preliminary result
        preliminary_result = {
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

        # Validate and enrich
        require_sources = os.getenv('REQUIRE_SOURCES_FOR_NEGATIVE_CLAIMS', 'true').lower() == 'true'
        result = claim_validator.validate_analysis_result(
            preliminary_result,
            require_sources=require_sources,
            article_date=article_date
        )

        # Apply aggregation logic to final result (same lenient logic as non-streaming)
        # Also handle quoted vs non-quoted content
        if fact_checked_claims:
            # Separate claims by severity
            false_claims = [c for c in fact_checked_claims if c['status'] == 'False']
            misleading_claims = [c for c in fact_checked_claims if c['status'] == 'Misleading']
            unsubstantiated_claims = [c for c in fact_checked_claims if c['status'] == 'Unsubstantiated']
            verified_claims = [c for c in fact_checked_claims if c['status'] == 'Verified']

            # Get flagged snippets for quote analysis
            final_snippets = result.get('flagged_snippets', [])
            non_quoted_snippets = [s for s in final_snippets if not s.get('is_quote', False)]
            non_quoted_misinfo = [s for s in non_quoted_snippets if 'misinformation' in s.get('type', '').lower() or 'disinformation' in s.get('type', '').lower()]

            # Calculate penalty multiplier based on quote ratio
            quote_ratio = 1 - (len(non_quoted_snippets) / max(len(final_snippets), 1))
            penalty_multiplier = 1.0 if quote_ratio < 0.3 else (1.0 - quote_ratio * 0.5)

            # Apply penalties based on severity
            if false_claims:
                # Direct misinformation - harsh penalty (but less harsh if in quotes)
                penalty = int(25 * penalty_multiplier) if penalty_multiplier < 1.0 else 25
                result['trust_score'] = min(result['trust_score'], max(penalty, 35))
                result['label'] = "Likely Fake" if penalty_multiplier > 0.7 else "Suspicious"

                if len(non_quoted_misinfo) > 0:
                    result['explanation']['summary'] += f" Contains {len(false_claims)} proven false claim(s)."
                else:
                    result['explanation']['summary'] += f" Contains {len(false_claims)} false claim(s) in quoted statements."
            elif misleading_claims:
                # Misleading information - moderate penalty
                penalty = int(15 * penalty_multiplier) if penalty_multiplier < 1.0 else 15
                result['trust_score'] = max(15, result['trust_score'] - (len(misleading_claims) * penalty))
                if result['trust_score'] < 50:
                    result['label'] = "Suspicious"

                if len(non_quoted_misinfo) > 0:
                    result['explanation']['summary'] += f" Contains {len(misleading_claims)} misleading claim(s)."
                else:
                    result['explanation']['summary'] += f" Contains {len(misleading_claims)} misleading claim(s) in quoted statements."
            elif unsubstantiated_claims:
                # Unsubstantiated - minor penalty (warning)
                penalty = int(8 * penalty_multiplier) if penalty_multiplier < 1.0 else 8
                result['trust_score'] = max(30, result['trust_score'] - (len(unsubstantiated_claims) * penalty))
                if result['trust_score'] < 65:
                    result['label'] = "Suspicious"

                if len(non_quoted_misinfo) > 0:
                    result['explanation']['summary'] += f" Warning: {len(unsubstantiated_claims)} claim(s) could not be verified."
                else:
                    result['explanation']['summary'] += f" Warning: {len(unsubstantiated_claims)} claim(s) in quotes could not be verified."
            elif verified_claims and len(verified_claims) >= len(fact_checked_claims) / 2:
                if result['trust_score'] > 40:
                    result['trust_score'] = max(result['trust_score'], 80)
                    result['label'] = "Likely True"

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
