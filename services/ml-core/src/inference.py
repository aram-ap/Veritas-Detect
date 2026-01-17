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
from typing import Dict, List, Tuple, Optional

# Add src to path for imports
sys.path.append(os.path.dirname(__file__))
from preprocessing import prepare_for_model


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
        self.load_model()
        
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
        # Normalize decision score to 0-1 range using sigmoid
        probability = 1 / (1 + np.exp(-decision_score))
        
        # Calculate trust score (0-100)
        # If prediction is 1 (Real), trust score is high
        # If prediction is 0 (Fake), trust score is low
        if prediction == 1:
            trust_score = int(probability * 100)
        else:
            trust_score = int((1 - probability) * 100)
        
        # Determine label based on trust score
        if trust_score >= 70:
            label = "Likely True"
        elif trust_score >= 40:
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
        
        Args:
            feature: The feature (word/ngram) that triggered the flag
            score: The importance score
            
        Returns:
            Human-readable reason string
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
    """Detects political bias in text using keyword analysis."""
    
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
        
        Args:
            text: Text to analyze
            
        Returns:
            Bias classification: "Left", "Left-Center", "Center", "Right-Center", "Right"
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


def predict_full_analysis(text: str, title: Optional[str] = None) -> Dict:
    """
    Perform complete analysis: misinformation detection, bias detection, and highlighting.
    
    Args:
        text: Article text
        title: Optional article title
        
    Returns:
        Complete analysis dictionary ready for API response
    """
    # Initialize predictors
    misinfo_predictor = MisinfoPredictor()
    bias_detector = BiasDetector()
    
    # Get misinformation prediction
    misinfo_result = misinfo_predictor.predict_misinformation(text, title)
    
    # Get bias detection
    bias = bias_detector.detect_bias(text)
    
    # Get suspicious snippets
    snippets = misinfo_predictor.get_suspicious_snippets(text, title, top_n=5)
    
    # Format snippets for API response
    flagged_snippets = []
    for snippet in snippets:
        flagged_snippets.append({
            'text': snippet['text'],
            'index': [snippet['start'], snippet['end']],
            'reason': snippet['reason'],
            'confidence': snippet['confidence']
        })
    
    # Combine results
    result = {
        'trust_score': misinfo_result['trust_score'],
        'label': misinfo_result['label'],
        'bias': bias,
        'flagged_snippets': flagged_snippets,
        'metadata': {
            'model_confidence': misinfo_result['confidence'],
            'prediction': misinfo_result['prediction']
        }
    }
    
    return result
