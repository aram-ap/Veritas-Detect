import json
import os
import hashlib
from typing import Optional, Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class AnalysisCache:
    def __init__(self, cache_file: str = "data/analysis_cache.json"):
        self.cache_file = Path(cache_file)
        self.cache: Dict[str, Any] = {}
        self._load_cache()

    def _load_cache(self):
        """Load cache from disk."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    self.cache = json.load(f)
                logger.info(f"Loaded {len(self.cache)} entries from cache")
            except Exception as e:
                logger.error(f"Failed to load cache: {e}")
                self.cache = {}
        else:
            # Ensure directory exists
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)

    def _save_cache(self):
        """Save cache to disk."""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    def _get_key(self, url: Optional[str], text: str) -> str:
        """Generate a unique key for the content."""
        if url and len(url) > 10:  # Use URL if valid
            return url
        # Fallback to hash of text
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    def get(self, url: Optional[str], text: str) -> Optional[Dict[str, Any]]:
        """Get analysis result from cache."""
        key = self._get_key(url, text)
        return self.cache.get(key)

    def set(self, url: Optional[str], text: str, data: Dict[str, Any]):
        """Save analysis result to cache."""
        key = self._get_key(url, text)
        self.cache[key] = data
        self._save_cache()

# Global cache instance
_cache_instance = None

def get_cache() -> AnalysisCache:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = AnalysisCache()
    return _cache_instance
