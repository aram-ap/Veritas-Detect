"""
Model training script for misinformation detection.

This script loads the Kaggle dataset, preprocesses it, trains a
PassiveAggressiveClassifier with TF-IDF features, and saves the model.

Usage:
    python src/training.py
    
Requirements:
    - Dataset must be placed at: data/dataset.csv
    - Dataset should have columns: 'text', 'label' (0=Fake, 1=Real)
"""

import os
import sys
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import PassiveAggressiveClassifier
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix

# Add src to path for imports
sys.path.append(os.path.dirname(__file__))
from preprocessing import clean_text, prepare_for_model


class MisinfoModelTrainer:
    """Handles training and evaluation of the misinformation detection model."""
    
    def __init__(self, dataset_path: str = "data/dataset.csv"):
        """
        Initialize the trainer.
        
        Args:
            dataset_path: Path to the CSV dataset
        """
        self.dataset_path = dataset_path
        self.vectorizer = None
        self.classifier = None
        self.model_path = Path("models/misinfo_model.pkl")
        
    def load_data(self) -> tuple:
        """
        Load and preprocess the dataset.
        
        Returns:
            Tuple of (X_train, X_test, y_train, y_test)
        """
        print(f"Loading dataset from {self.dataset_path}...")
        
        if not os.path.exists(self.dataset_path):
            raise FileNotFoundError(
                f"Dataset not found at {self.dataset_path}. "
                "Please download the Kaggle dataset and place it in the data/ folder."
            )
        
        # Load CSV
        df = pd.read_csv(self.dataset_path)
        
        print(f"Loaded {len(df)} samples")
        print(f"Columns: {df.columns.tolist()}")
        
        # Handle different possible column names
        text_col = None
        label_col = None
        title_col = None
        
        # Find text column
        for col in ['text', 'content', 'article', 'body']:
            if col in df.columns:
                text_col = col
                break
        
        # Find label column
        for col in ['label', 'class', 'target', 'fake']:
            if col in df.columns:
                label_col = col
                break
        
        # Find title column (optional)
        for col in ['title', 'headline']:
            if col in df.columns:
                title_col = col
                break
        
        if not text_col or not label_col:
            raise ValueError(
                f"Could not find required columns. Found: {df.columns.tolist()}. "
                "Expected 'text' and 'label' columns."
            )
        
        print(f"Using columns: text='{text_col}', label='{label_col}', title='{title_col}'")
        
        # Drop missing values
        df = df.dropna(subset=[text_col, label_col])
        
        # Prepare text data
        print("Preprocessing text...")
        if title_col:
            df['processed_text'] = df.apply(
                lambda row: prepare_for_model(str(row[text_col]), str(row[title_col])),
                axis=1
            )
        else:
            df['processed_text'] = df[text_col].apply(lambda x: prepare_for_model(str(x)))
        
        # Remove empty texts
        df = df[df['processed_text'].str.len() > 10]
        
        # Prepare labels (ensure binary: 0=Fake, 1=Real)
        labels = df[label_col].values
        unique_labels = np.unique(labels)
        print(f"Unique labels: {unique_labels}")
        
        # Convert labels to binary if needed
        if len(unique_labels) == 2:
            # Map to 0 and 1 if not already
            label_map = {unique_labels[0]: 0, unique_labels[1]: 1}
            df['binary_label'] = df[label_col].map(label_map)
        else:
            raise ValueError(f"Expected 2 classes, found {len(unique_labels)}")
        
        print(f"Label distribution:\n{df['binary_label'].value_counts()}")
        
        X = df['processed_text'].values
        y = df['binary_label'].values
        
        # Split data
        print("Splitting data into train/test sets (80/20)...")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        print(f"Training samples: {len(X_train)}")
        print(f"Testing samples: {len(X_test)}")
        
        return X_train, X_test, y_train, y_test
    
    def train(self, X_train, y_train):
        """
        Train the TF-IDF + PassiveAggressiveClassifier model.
        
        Args:
            X_train: Training text data
            y_train: Training labels
        """
        print("\nTraining TF-IDF Vectorizer...")
        
        # Initialize TF-IDF vectorizer
        self.vectorizer = TfidfVectorizer(
            max_features=10000,  # Limit vocabulary size
            ngram_range=(1, 3),  # Use unigrams, bigrams, and trigrams
            min_df=5,  # Ignore terms that appear in less than 5 documents
            max_df=0.7,  # Ignore terms that appear in more than 70% of documents
            stop_words='english'
        )
        
        # Transform training data
        X_train_tfidf = self.vectorizer.fit_transform(X_train)
        print(f"TF-IDF matrix shape: {X_train_tfidf.shape}")
        
        print("\nTraining PassiveAggressiveClassifier...")
        
        # Initialize and train classifier
        self.classifier = PassiveAggressiveClassifier(
            max_iter=50,
            random_state=42,
            n_jobs=-1  # Use all CPU cores
        )
        
        self.classifier.fit(X_train_tfidf, y_train)
        print("Training completed!")
    
    def evaluate(self, X_test, y_test):
        """
        Evaluate the trained model on test data.
        
        Args:
            X_test: Test text data
            y_test: Test labels
        """
        print("\n" + "="*60)
        print("EVALUATION RESULTS")
        print("="*60)
        
        # Transform test data
        X_test_tfidf = self.vectorizer.transform(X_test)
        
        # Make predictions
        y_pred = self.classifier.predict(X_test_tfidf)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        print(f"\nAccuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
        print(f"F1-Score: {f1:.4f}")
        
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=['Fake', 'Real']))
        
        print("\nConfusion Matrix:")
        cm = confusion_matrix(y_test, y_pred)
        print(cm)
        print(f"True Negatives: {cm[0][0]}, False Positives: {cm[0][1]}")
        print(f"False Negatives: {cm[1][0]}, True Positives: {cm[1][1]}")
        
        return accuracy, f1
    
    def save_model(self):
        """Save the trained model and vectorizer to disk."""
        print(f"\nSaving model to {self.model_path}...")
        
        # Create models directory if it doesn't exist
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save both vectorizer and classifier
        model_data = {
            'vectorizer': self.vectorizer,
            'classifier': self.classifier
        }
        
        joblib.dump(model_data, self.model_path)
        print(f"Model saved successfully! Size: {self.model_path.stat().st_size / 1024:.2f} KB")
    
    def run_full_pipeline(self):
        """Execute the complete training pipeline."""
        print("="*60)
        print("MISINFORMATION DETECTION MODEL TRAINING")
        print("="*60)
        
        try:
            # Load data
            X_train, X_test, y_train, y_test = self.load_data()
            
            # Train model
            self.train(X_train, y_train)
            
            # Evaluate model
            self.evaluate(X_test, y_test)
            
            # Save model
            self.save_model()
            
            print("\n" + "="*60)
            print("TRAINING PIPELINE COMPLETED SUCCESSFULLY!")
            print("="*60)
            
        except Exception as e:
            print(f"\nERROR: Training pipeline failed!")
            print(f"Details: {str(e)}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


def main():
    """Main entry point for training script."""
    trainer = MisinfoModelTrainer()
    trainer.run_full_pipeline()


if __name__ == "__main__":
    main()
