"""
Web search service for verifying current events and finding credible sources.

Uses Google Custom Search API for finding recent news and credible sources.
"""

import os
import logging
import requests
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class WebSearchService:
    """
    Service for searching the web to verify current events and find sources.
    """

    TRUSTED_NEWS_SOURCES = [
        "reuters.com", "apnews.com", "bbc.com", "npr.org",
        "pbs.org", "wsj.com", "bloomberg.com", "snopes.com",
        "nytimes.com", "washingtonpost.com", "theguardian.com",
        "ft.com", "latimes.com", "usatoday.com", "politico.com",
        "axios.com", "abcnews.go.com", "cbsnews.com", "nbcnews.com",
        "cnn.com"
    ]

    def __init__(self, google_api_key: Optional[str] = None, search_engine_id: Optional[str] = None):
        """
        Initialize the web search service.

        Args:
            google_api_key: Google API key for Custom Search API
            search_engine_id: Google Custom Search Engine ID
        """
        self.google_api_key = google_api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.search_engine_id = search_engine_id or os.getenv("GOOGLE_SEARCH_ENGINE_ID")
        
        # Validate Search Engine ID format (should not be an API key)
        if self.search_engine_id and self.search_engine_id.startswith("AIza"):
            logger.error("=" * 70)
            logger.error("❌ INVALID GOOGLE_SEARCH_ENGINE_ID")
            logger.error("You've provided an API key instead of a Search Engine ID!")
            logger.error("Search Engine IDs look like: '017576662512468239146:omuauf_lfve'")
            logger.error("Create one at: https://programmablesearchengine.google.com/")
            logger.error("=" * 70)
            self.search_engine_id = None  # Disable to prevent API errors
        
        # Use example ID as fallback only if none provided
        if not self.search_engine_id:
            self.search_engine_id = "017576662512468239146:omuauf_lfve"
            logger.warning("Using example Search Engine ID. Create your own for production.")

        self.enabled = bool(self.google_api_key)

        if not self.enabled:
            logger.warning("=" * 70)
            logger.warning("⚠️  GOOGLE API KEY NOT FOUND - Web Search Disabled")
            logger.warning("Breaking news verification will not work properly.")
            logger.warning("Set GOOGLE_API_KEY or GEMINI_API_KEY in your .env file.")
            logger.warning("=" * 70)
        else:
            logger.info(f"✓ WebSearchService initialized - API key found")
            
        if not self.search_engine_id or self.search_engine_id == "017576662512468239146:omuauf_lfve":
            logger.warning("Using example Custom Search Engine ID. Set GOOGLE_SEARCH_ENGINE_ID for production.")

    def search_for_verification(
        self,
        query: str,
        num_results: int = 5,
        recent_only: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Search for credible sources to verify a claim.

        Args:
            query: The search query
            num_results: Number of results to return
            recent_only: If True, prioritize recent results (last 30 days)

        Returns:
            List of search results with title, url, snippet
        """
        if not self.enabled:
            return []

        try:
            # Use Google Custom Search API
            url = "https://www.googleapis.com/customsearch/v1"

            params = {
                "key": self.google_api_key,
                "cx": self.search_engine_id,
                "q": query,
                "num": num_results,
            }

            # Add date restriction for recent results
            if recent_only:
                # Search for results from the last 30 days
                params["dateRestrict"] = "m1"  # Last month

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # Extract relevant information
            results = []
            for item in data.get("items", []):
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                    "source": self._extract_domain(item.get("link", "")),
                    "is_credible": self._is_credible_source(item.get("link", ""))
                })

            return results

        except requests.exceptions.RequestException as e:
            logger.error(f"Web search request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Error during web search: {e}")
            return []

    def search_news(
        self,
        query: str,
        num_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search specifically for news articles about a topic.

        Args:
            query: The search query
            num_results: Number of results to return

        Returns:
            List of news results
        """
        if not self.enabled:
            return []

        try:
            # Use Google Custom Search API
            # Note: tbm=nws is NOT supported in Custom Search JSON API
            # We rely on filtering results by trusted domains after retrieval
            url = "https://www.googleapis.com/customsearch/v1"

            params = {
                "key": self.google_api_key,
                "cx": self.search_engine_id,
                "q": query,
                "num": min(num_results, 10),  # API limit is 10 per request
                "dateRestrict": "m1",  # Last month
                "sort": "date"  # Sort by date for recent news
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # Extract news results and filter to trusted sources
            results = []
            for item in data.get("items", []):
                url = item.get("link", "")
                # Only include results from trusted sources
                if self._is_credible_source(url):
                    results.append({
                        "title": item.get("title", ""),
                        "url": url,
                        "snippet": item.get("snippet", ""),
                        "source": self._extract_domain(url),
                        "date": item.get("pagemap", {}).get("metatags", [{}])[0].get("article:published_time", ""),
                        "is_credible": True
                    })
                    
                    # Stop if we have enough results
                    if len(results) >= num_results:
                        break

            return results

        except Exception as e:
            logger.error(f"News search failed: {e}")
            return []

    def search_consensus(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for consensus among trusted news sources.
        """
        if not self.enabled:
            return []
            
        # We search specifically for news to get the latest coverage
        # The credibility scoring handles the "trusted" filtering
        return self.search_news(query, num_results=10)

    def calculate_credibility_score(self, results: List[Dict[str, Any]]) -> float:
        """
        Calculate credibility score based on trusted sources consensus.
        
        Returns:
            Float between 0.0 and 1.0 representing consensus strength
        """
        if not results:
            return 0.0
            
        unique_trusted_sources = set()
        for result in results:
            domain = result.get('source', '') or self._extract_domain(result.get('url', ''))
            
            # Check if domain matches any trusted source
            for trusted in self.TRUSTED_NEWS_SOURCES:
                if trusted in domain.lower():
                    unique_trusted_sources.add(trusted)
                    
        count = len(unique_trusted_sources)
        
        if count >= 3:
            return 0.9  # High Consensus
        elif count == 2:
            return 0.7  # Moderate Consensus
        elif count == 1:
            return 0.4  # Single Source
        else:
            return 0.1  # No Trusted Sources

    def _extract_domain(self, url: str) -> str:
        """Extract the domain from a URL."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc.replace("www.", "")
        except:
            return ""

    def _is_credible_source(self, url: str) -> bool:
        """
        Check if a source is generally considered credible for news/facts.

        This is a simple heuristic based on well-known credible sources.
        """
        url_lower = url.lower()
        return any(domain in url_lower for domain in self.TRUSTED_NEWS_SOURCES)

    def verify_claim_with_sources(
        self,
        claim: str,
        search_query: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Verify a claim and return sources.

        Args:
            claim: The claim to verify
            search_query: Optional specific search query (defaults to the claim)

        Returns:
            Dictionary with verification results and sources
        """
        query = search_query or claim

        # Search for verification
        results = self.search_for_verification(query, num_results=5, recent_only=True)

        if not results:
            return {
                "status": "Unverified",
                "confidence": 0.0,
                "sources": [],
                "summary": "No sources found to verify this claim."
            }

        # Count credible sources
        credible_count = sum(1 for r in results if r.get("is_credible", False))

        # Determine status based on sources found
        if credible_count >= 2:
            status = "Verified - Multiple credible sources found"
            confidence = 0.8
        elif credible_count == 1:
            status = "Likely True - One credible source found"
            confidence = 0.6
        else:
            status = "Needs Review - Sources found but credibility unclear"
            confidence = 0.4

        return {
            "status": status,
            "confidence": confidence,
            "sources": [
                {
                    "title": r["title"],
                    "url": r["url"],
                    "snippet": r["snippet"],
                    "source": r["source"],
                    "is_credible": r.get("is_credible", False)
                }
                for r in results[:5]
            ],
            "summary": f"Found {len(results)} sources ({credible_count} credible)"
        }


# Singleton instance
_web_search_instance: Optional[WebSearchService] = None


def get_web_search() -> WebSearchService:
    """Get or create the global web search instance."""
    global _web_search_instance
    if _web_search_instance is None:
        _web_search_instance = WebSearchService()
    return _web_search_instance
