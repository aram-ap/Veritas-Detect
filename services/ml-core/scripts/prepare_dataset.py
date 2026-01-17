"""
Dataset Preparation Script

This script combines the separate FAKE and TRUE dataset files into a single
CSV file that the training script can use.

Usage:
    python scripts/prepare_dataset.py

Input files expected:
    - data/DataSet_Misinfo_FAKE.csv
    - data/DataSet_Misinfo_TRUE.csv

Output:
    - data/dataset.csv (combined with labels)
"""

import os
import sys
import pandas as pd
from pathlib import Path


def prepare_dataset():
    """Combine FAKE and TRUE datasets into a single labeled dataset."""
    
    print("="*60)
    print("Dataset Preparation Script")
    print("="*60)
    print()
    
    # Define file paths
    data_dir = Path("data")
    fake_file = data_dir / "DataSet_Misinfo_FAKE.csv"
    true_file = data_dir / "DataSet_Misinfo_TRUE.csv"
    output_file = data_dir / "dataset.csv"
    
    # Check if files exist
    if not fake_file.exists():
        print(f"❌ Error: {fake_file} not found")
        print(f"   Please download and place it in the data/ folder")
        sys.exit(1)
    
    if not true_file.exists():
        print(f"❌ Error: {true_file} not found")
        print(f"   Please download and place it in the data/ folder")
        sys.exit(1)
    
    print(f"✓ Found: {fake_file}")
    print(f"✓ Found: {true_file}")
    print()
    
    # Load the datasets
    print("Loading FAKE dataset...")
    try:
        fake_df = pd.read_csv(fake_file)
        print(f"  Loaded {len(fake_df)} fake news articles")
        print(f"  Columns: {fake_df.columns.tolist()}")
    except Exception as e:
        print(f"❌ Error loading FAKE dataset: {e}")
        sys.exit(1)
    
    print()
    print("Loading TRUE dataset...")
    try:
        true_df = pd.read_csv(true_file)
        print(f"  Loaded {len(true_df)} real news articles")
        print(f"  Columns: {true_df.columns.tolist()}")
    except Exception as e:
        print(f"❌ Error loading TRUE dataset: {e}")
        sys.exit(1)
    
    print()
    
    # Add labels
    print("Adding labels...")
    fake_df['label'] = 0  # 0 = Fake
    true_df['label'] = 1  # 1 = Real/True
    print("  Fake articles: label = 0")
    print("  True articles: label = 1")
    print()
    
    # Combine datasets
    print("Combining datasets...")
    combined_df = pd.concat([fake_df, true_df], ignore_index=True)
    print(f"  Total articles: {len(combined_df)}")
    print()
    
    # Shuffle the dataset
    print("Shuffling dataset...")
    combined_df = combined_df.sample(frac=1, random_state=42).reset_index(drop=True)
    print("  ✓ Dataset shuffled")
    print()
    
    # Display statistics
    print("Dataset Statistics:")
    print("-" * 40)
    print(f"  Total samples: {len(combined_df)}")
    print(f"  Fake (label=0): {len(combined_df[combined_df['label'] == 0])} ({len(combined_df[combined_df['label'] == 0]) / len(combined_df) * 100:.1f}%)")
    print(f"  True (label=1): {len(combined_df[combined_df['label'] == 1])} ({len(combined_df[combined_df['label'] == 1]) / len(combined_df) * 100:.1f}%)")
    print(f"  Columns: {combined_df.columns.tolist()}")
    print()
    
    # Check for missing values
    missing = combined_df.isnull().sum()
    if missing.any():
        print("Missing values:")
        print(missing[missing > 0])
        print()
    
    # Display sample
    print("Sample rows:")
    print("-" * 40)
    print(combined_df.head(3)[['title', 'text', 'label'] if 'title' in combined_df.columns else ['text', 'label']])
    print()
    
    # Save combined dataset
    print(f"Saving combined dataset to {output_file}...")
    combined_df.to_csv(output_file, index=False)
    
    # Verify file was created
    if output_file.exists():
        file_size = output_file.stat().st_size / (1024 * 1024)  # MB
        print(f"  ✓ Dataset saved successfully!")
        print(f"  File size: {file_size:.2f} MB")
    else:
        print(f"  ❌ Error: Failed to save dataset")
        sys.exit(1)
    
    print()
    print("="*60)
    print("Dataset Preparation Complete!")
    print("="*60)
    print()
    print("Next step: Train the model")
    print("  python src/training.py")
    print()


if __name__ == "__main__":
    try:
        prepare_dataset()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
