"""
Fact-checking service that verifies claims using external APIs.

Supports:
- Google Fact Check Tools API (free)
- SerpAPI for recent news verification (optional)
- Web search fallback for claim validation
"""

import os
import logging
import requests
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import json

logger = logging.getLogger(__name__)


@dataclass
class FactCheckResult:
    """Structured result from a fact-check query."""
    claim: str
    status: str  # "Verified", "False", "Misleading", "Unverified", "Mixed"
    explanation: str
    sources: List[str]
    confidence: float  # 0-1
    checked_at: str


class FactCheckService:
    """
    Fact-checking service that uses multiple APIs to verify claims.
    """

    def __init__(
        self,
        google_api_key: Optional[str] = None,
        serp_api_key: Optional[str] = None
    ):
        """
        Initialize the fact-checking service.

        Args:
            google_api_key: Google API key for Fact Check Tools API
            serp_api_key: SerpAPI key for enhanced search (optional)
        """
        self.google_api_key = google_api_key or os.getenv("GOOGLE_FACT_CHECK_API_KEY")
        self.serp_api_key = serp_api_key or os.getenv("SERP_API_KEY")

        # Track which services are enabled
        self.google_enabled = bool(self.google_api_key)
        self.serp_enabled = bool(self.serp_api_key)

        if not self.google_enabled:
            logger.warning("Google Fact Check API key not found. Fact-checking will be limited.")

        logger.info(f"FactCheckService initialized - Google: {self.google_enabled}, SerpAPI: {self.serp_enabled}")

    def check_claims(
        self,
        claims: List[str],
        max_results_per_claim: int = 3
    ) -> List[FactCheckResult]:
        """
        Check multiple claims against fact-checking databases.

        Args:
            claims: List of factual claims to verify
            max_results_per_claim: Maximum fact-check results to retrieve per claim

        Returns:
            List of FactCheckResult objects
        """
        results = []

        for claim in claims:
            try:
                # Try Google Fact Check API first
                if self.google_enabled:
                    google_results = self._check_google_factcheck(claim, max_results_per_claim)
                    if google_results:
                        results.extend(google_results)
                        continue

                # If no Google results, try SerpAPI for recent news
                if self.serp_enabled:
                    serp_result = self._check_serp_api(claim)
                    if serp_result:
                        results.append(serp_result)
                        continue

                # If both fail, mark as unverified
                results.append(FactCheckResult(
                    claim=claim,
                    status="Unverified",
                    explanation="No fact-check data available for this claim.",
                    sources=[],
                    confidence=0.0,
                    checked_at=datetime.now().isoformat()
                ))

            except Exception as e:
                logger.error(f"Error checking claim '{claim}': {e}")
                results.append(FactCheckResult(
                    claim=claim,
                    status="Error",
                    explanation=f"Failed to verify: {str(e)}",
                    sources=[],
                    confidence=0.0,
                    checked_at=datetime.now().isoformat()
                ))

        return results

    def _check_google_factcheck(
        self,
        query: str,
        max_results: int = 3
    ) -> List[FactCheckResult]:
        """
        Check claim using Google Fact Check Tools API.

        API Docs: https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search
        """
        if not self.google_enabled:
            return []

        try:
            url = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
            params = {
                "key": self.google_api_key,
                "query": query,
                "languageCode": "en"
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # Parse the fact-check claims
            results = []
            claims = data.get("claims", [])[:max_results]

            for claim_data in claims:
                claim_review = claim_data.get("claimReview", [{}])[0]

                # Extract rating
                rating = claim_review.get("textualRating", "").lower()
                status = self._normalize_rating(rating)

                # Extract source
                publisher = claim_review.get("publisher", {})
                source_name = publisher.get("name", "Unknown source")
                source_url = claim_review.get("url", "")

                results.append(FactCheckResult(
                    claim=claim_data.get("text", query),
                    status=status,
                    explanation=claim_review.get("title", "") or f"Rated as '{rating}' by {source_name}",
                    sources=[source_url] if source_url else [],
                    confidence=0.8 if status in ["Verified", "False"] else 0.5,
                    checked_at=datetime.now().isoformat()
                ))

            return results

        except requests.exceptions.RequestException as e:
            logger.error(f"Google Fact Check API request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Error parsing Google Fact Check response: {e}")
            return []

    def _check_serp_api(self, query: str) -> Optional[FactCheckResult]:
        """
        Check claim using SerpAPI for recent news and credible sources.

        This is useful for very recent events that may not be in fact-check databases.
        """
        if not self.serp_enabled:
            return None

        try:
            url = "https://serpapi.com/search"
            params = {
                "api_key": self.serp_api_key,
                "q": f"{query} fact check",
                "num": 5,
                "engine": "google"
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            organic_results = data.get("organic_results", [])

            if not organic_results:
                return None

            # Analyze top results
            credible_sources = ["snopes.com", "factcheck.org", "politifact.com",
                              "reuters.com", "apnews.com", "bbc.com"]

            found_sources = []
            for result in organic_results[:3]:
                link = result.get("link", "")
                if any(source in link for source in credible_sources):
                    found_sources.append(link)

            if found_sources:
                return FactCheckResult(
                    claim=query,
                    status="Mixed",  # Conservative - requires manual review
                    explanation=f"Found {len(found_sources)} relevant fact-check articles. Manual review recommended.",
                    sources=found_sources,
                    confidence=0.6,
                    checked_at=datetime.now().isoformat()
                )

            return None

        except Exception as e:
            logger.error(f"SerpAPI request failed: {e}")
            return None

    def _normalize_rating(self, rating: str) -> str:
        """
        Normalize various fact-check ratings to standard categories.
        """
        rating_lower = rating.lower()

        # True/Verified
        if any(word in rating_lower for word in ["true", "correct", "accurate", "verified"]):
            return "Verified"

        # False
        if any(word in rating_lower for word in ["false", "incorrect", "debunked", "pants on fire"]):
            return "False"

        # Misleading/Mixed
        if any(word in rating_lower for word in ["misleading", "half", "mostly", "mixture", "mixed"]):
            return "Misleading"

        # Unverified
        return "Unverified"

    def get_status_summary(self, results: List[FactCheckResult]) -> Dict[str, Any]:
        """
        Generate a summary of fact-check results.
        """
        if not results:
            return {
                "overall_status": "No Claims Checked",
                "verified_count": 0,
                "false_count": 0,
                "misleading_count": 0,
                "unverified_count": 0,
                "total_count": 0
            }

        status_counts = {
            "Verified": 0,
            "False": 0,
            "Misleading": 0,
            "Unverified": 0,
            "Mixed": 0,
            "Error": 0
        }

        for result in results:
            status_counts[result.status] = status_counts.get(result.status, 0) + 1

        # Determine overall status
        total = len(results)
        false_count = status_counts["False"]
        misleading_count = status_counts["Misleading"]

        if false_count > 0:
            overall = "Contains False Claims"
        elif misleading_count > 0:
            overall = "Contains Misleading Claims"
        elif status_counts["Verified"] == total:
            overall = "All Claims Verified"
        else:
            overall = "Mixed or Unverified"

        return {
            "overall_status": overall,
            "verified_count": status_counts["Verified"],
            "false_count": status_counts["False"],
            "misleading_count": status_counts["Misleading"],
            "unverified_count": status_counts["Unverified"],
            "mixed_count": status_counts["Mixed"],
            "total_count": total
        }


# Singleton instance for reuse
_fact_checker_instance: Optional[FactCheckService] = None


def get_fact_checker() -> FactCheckService:
    """Get or create the global fact-checker instance."""
    global _fact_checker_instance
    if _fact_checker_instance is None:
        _fact_checker_instance = FactCheckService()
    return _fact_checker_instance
