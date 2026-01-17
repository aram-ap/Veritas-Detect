"""
Download ML model from external storage at runtime.

This script downloads the trained model from cloud storage (DigitalOcean Spaces, S3, etc.)
when the container starts, avoiding the need to include the large model file in git.

Usage:
    python download_model.py

Environment variables:
    MODEL_URL: URL to download the model from
    MODEL_PATH: Local path to save the model (default: models/misinfo_model.pkl)
"""

import os
import sys
import requests
from pathlib import Path
import hashlib


def download_file(url: str, destination: str, chunk_size: int = 8192):
    """Download a file from URL to destination with progress indication."""
    print(f"Downloading model from: {url}")
    print(f"Saving to: {destination}")
    
    # Create directory if it doesn't exist
    Path(destination).parent.mkdir(parents=True, exist_ok=True)
    
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(destination, 'wb') as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    # Show progress
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\rProgress: {percent:.1f}% ({downloaded}/{total_size} bytes)", end='')
        
        print("\n✓ Download complete!")
        return True
        
    except Exception as e:
        print(f"\n✗ Download failed: {str(e)}")
        return False


def verify_model_file(path: str) -> bool:
    """Verify the downloaded model file is valid."""
    if not os.path.exists(path):
        return False
    
    # Check file size (should be > 100MB for our model)
    size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"Model file size: {size_mb:.1f} MB")
    
    if size_mb < 100:
        print("Warning: Model file seems too small")
        return False
    
    # Try to load with pickle to verify it's valid
    try:
        import pickle
        with open(path, 'rb') as f:
            # Just read the first few bytes to verify it's a pickle file
            header = f.read(2)
            if header[0] != 0x80:  # Pickle protocol marker
                print("Warning: File doesn't appear to be a valid pickle file")
                return False
        print("✓ Model file appears valid")
        return True
    except Exception as e:
        print(f"Warning: Could not verify model file: {e}")
        return False


def main():
    """Main function to download the model."""
    # Get configuration from environment
    model_url = os.getenv('MODEL_URL')
    model_path = os.getenv('MODEL_PATH', 'models/misinfo_model.pkl')
    
    if not model_url:
        print("ERROR: MODEL_URL environment variable not set")
        print("\nSet it to your model's public URL:")
        print("  export MODEL_URL='https://your-space.nyc3.digitaloceanspaces.com/misinfo_model.pkl'")
        sys.exit(1)
    
    # Check if model already exists
    if os.path.exists(model_path):
        print(f"Model already exists at: {model_path}")
        if verify_model_file(model_path):
            print("✓ Using existing model file")
            return
        else:
            print("Existing model file is invalid, re-downloading...")
    
    # Download the model
    print(f"\nDownloading model...")
    print(f"From: {model_url}")
    print(f"To: {model_path}")
    print("-" * 50)
    
    success = download_file(model_url, model_path)
    
    if success:
        if verify_model_file(model_path):
            print("\n✓ Model downloaded and verified successfully!")
            sys.exit(0)
        else:
            print("\n✗ Model downloaded but verification failed")
            sys.exit(1)
    else:
        print("\n✗ Failed to download model")
        sys.exit(1)


if __name__ == "__main__":
    main()
