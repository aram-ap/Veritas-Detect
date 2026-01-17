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

    def __init__(self, google_api_key: Optional[str] = None, search_engine_id: Optional[str] = None):
        """
        Initialize the web search service.

        Args:
            google_api_key: Google API key for Custom Search API
            search_engine_id: Google Custom Search Engine ID
        """
        self.google_api_key = google_api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.search_engine_id = search_engine_id or os.getenv("GOOGLE_SEARCH_ENGINE_ID") or "017576662512468239146:omuauf_lfve"  # Example ID

        self.enabled = bool(self.google_api_key)

        if not self.enabled:
            logger.warning("Google API key not found. Web search will be disabled.")

        logger.info(f"WebSearchService initialized - Enabled: {self.enabled}")

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
            # Use Google News search
            url = "https://www.googleapis.com/customsearch/v1"

            params = {
                "key": self.google_api_key,
                "cx": self.search_engine_id,
                "q": query,
                "num": num_results,
                "tbm": "nws",  # News search
                "dateRestrict": "m1"  # Last month
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # Extract news results
            results = []
            for item in data.get("items", []):
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                    "source": self._extract_domain(item.get("link", "")),
                    "date": item.get("pagemap", {}).get("metatags", [{}])[0].get("article:published_time", ""),
                    "is_credible": self._is_credible_source(item.get("link", ""))
                })

            return results

        except Exception as e:
            logger.error(f"News search failed: {e}")
            return []

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
        credible_domains = [
            # Major news organizations
            "reuters.com", "apnews.com", "bbc.com", "npr.org",
            "pbs.org", "csmonitor.com", "economist.com",

            # Fact-checking sites
            "snopes.com", "factcheck.org", "politifact.com",
            "fullfact.org", "factchecker.com",

            # Academic/Research
            "nature.com", "science.org", "sciencedirect.com",
            "pubmed.gov", "nih.gov", "cdc.gov", "who.int",

            # Government sources
            "gov", "edu",  # Generic government and educational

            # Major newspapers (generally credible)
            "nytimes.com", "washingtonpost.com", "wsj.com",
            "theguardian.com", "ft.com", "latimes.com"
        ]

        url_lower = url.lower()
        return any(domain in url_lower for domain in credible_domains)

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
