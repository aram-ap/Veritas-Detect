"""
Text preprocessing utilities for misinformation detection.

This module provides functions to clean and normalize text data for 
machine learning model training and inference.
"""

import re
import string
from typing import Optional


def clean_text(text: str) -> str:
    """
    Clean and normalize text for ML processing.
    
    Args:
        text: Raw text input
        
    Returns:
        Cleaned and normalized text string
    """
    if not text or not isinstance(text, str):
        return ""
    
    # Remove HTML tags
    text = re.sub(r'<.*?>', ' ', text)
    
    # Remove URLs
    text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', ' ', text)
    text = re.sub(r'www\.(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', ' ', text)
    
    # Remove email addresses
    text = re.sub(r'\S+@\S+', ' ', text)
    
    # Remove special characters but keep basic punctuation
    text = re.sub(r'[^a-zA-Z0-9\s.,!?\'\"-]', ' ', text)
    
    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text)
    
    # Convert to lowercase
    text = text.lower()
    
    # Strip leading/trailing whitespace
    text = text.strip()
    
    return text


def remove_stopwords(text: str, stopwords: Optional[set] = None) -> str:
    """
    Remove common stopwords from text (optional enhancement).
    
    Args:
        text: Cleaned text input
        stopwords: Set of stopwords to remove
        
    Returns:
        Text with stopwords removed
    """
    if stopwords is None:
        # Basic stopwords - can be expanded
        stopwords = {
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 
            'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 
            'that', 'the', 'to', 'was', 'will', 'with'
        }
    
    words = text.split()
    filtered_words = [word for word in words if word not in stopwords]
    return ' '.join(filtered_words)


def extract_features(text: str, title: Optional[str] = None) -> dict:
    """
    Extract additional features from text that may indicate misinformation.
    
    Args:
        text: Article text
        title: Article title (optional)
        
    Returns:
        Dictionary of extracted features
    """
    features = {}
    
    # Sensationalist language indicators
    sensationalist_words = [
        'shocking', 'amazing', 'unbelievable', 'incredible', 'miracle',
        'secret', 'exposed', 'revealed', 'truth', 'they don\'t want you to know'
    ]
    
    text_lower = text.lower()
    features['sensationalist_count'] = sum(1 for word in sensationalist_words if word in text_lower)
    
    # ALL CAPS words (often used in fake news)
    words = text.split()
    all_caps_words = [w for w in words if len(w) > 2 and w.isupper()]
    features['all_caps_ratio'] = len(all_caps_words) / max(len(words), 1)
    
    # Exclamation marks
    features['exclamation_count'] = text.count('!')
    
    # Question marks
    features['question_count'] = text.count('?')
    
    # Average word length
    features['avg_word_length'] = sum(len(w) for w in words) / max(len(words), 1)
    
    return features


def prepare_for_model(text: str, title: Optional[str] = None) -> str:
    """
    Prepare text for model input by combining title and text, then cleaning.
    
    Args:
        text: Article text
        title: Article title (optional)
        
    Returns:
        Combined and cleaned text ready for model input
    """
    # Combine title and text if title is provided
    combined = ""
    if title:
        combined = f"{title}. {text}"
    else:
        combined = text
    
    # Clean the combined text
    cleaned = clean_text(combined)
    
    return cleaned
