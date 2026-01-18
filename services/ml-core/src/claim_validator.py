"""
Claim Validator - Intercepts and verifies negative assertions before they're returned.

This module prevents the AI from making unverified claims about things not existing
or being false. It requires all such claims to be backed by external sources.
"""

import re
import logging
import datetime
from typing import List, Dict, Any, Optional, Tuple
from fact_checker import get_fact_checker, FactCheckResult

logger = logging.getLogger(__name__)


class ClaimValidator:
    """
    Validates claims and ensures negative assertions are backed by sources.
    """

    # Patterns that indicate negative assertions requiring verification
    NEGATIVE_CLAIM_PATTERNS = [
        # Non-existence claims
        r"(does not|doesn't|do not|don't) exist",
        r"(never|no) existed",
        r"(is|are) (not|no) real",
        r"(is|are) fake",
        r"(is|are) fabricated",
        r"made up",
        r"fictional",
        r"(no|zero|never) evidence",

        # Falsity claims
        r"(is|are) false",
        r"(is|are) untrue",
        r"(is|are) incorrect",
        r"(is|are) wrong",
        r"(has|have) been debunked",
        r"(never|didn't) happen",
        r"(never|didn't) occur",
        r"(no|not) (true|accurate|real|valid)",

        # Denial claims
        r"(no|not) (proof|evidence|data|records)",
        r"(cannot|can't) be (verified|confirmed|validated)",
        r"(not|no) documented",
        r"(not|no) confirmed",

        # Temporal impossibility
        r"(could not|couldn't) have (happened|occurred|existed)",
        r"(impossible|implausible) (that|for)",
    ]

    # Recent news keywords for classification
    RECENT_NEWS_KEYWORDS = [
        'today', 'yesterday', 'this week', 'this month', 'breaking',
        'just now', 'live', 'update', 'current', 'latest', 'recently',
        'new', 'report', 'announced', 'resignation', 'shooting',
        'federal', 'prosecutor', 'ICE', 'agent'
    ]

    def __init__(self):
        """Initialize the claim validator."""
        self.patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.NEGATIVE_CLAIM_PATTERNS]
        self.web_search = None  # Lazy loaded
        self.current_year = datetime.datetime.now().year

    def contains_negative_assertion(self, text: str) -> bool:
        """
        Check if text contains a negative assertion that requires verification.

        Args:
            text: Text to check

        Returns:
            True if text contains negative assertions
        """
        for pattern in self.patterns:
            if pattern.search(text):
                return True
        return False

    def is_recent_news_claim(self, text: str, article_date: Optional[str] = None) -> bool:
        """
        Check if a claim is about recent news that requires web search verification.

        Args:
            text: The claim text
            article_date: Optional article publication date

        Returns:
            True if claim appears to be about recent events
        """
        text_lower = text.lower()

        # Check for recent keywords
        for keyword in self.RECENT_NEWS_KEYWORDS:
            if re.search(r'\b' + re.escape(keyword) + r'\b', text_lower):
                return True

        # Check for current/recent years
        recent_years = [str(self.current_year), str(self.current_year - 1)]
        if any(year in text for year in recent_years):
            return True

        # If article date is recent (within last 60 days), consider it recent news
        if article_date:
            try:
                # Try parsing ISO format or common date formats
                from dateutil import parser as date_parser
                parsed_date = date_parser.parse(article_date)
                days_ago = (datetime.datetime.now() - parsed_date).days
                if days_ago <= 60:
                    return True
            except:
                pass

        return False

    def extract_claims_from_text(self, text: str) -> List[str]:
        """
        Extract verifiable claims from text that contains negative assertions.

        Args:
            text: Text to extract claims from

        Returns:
            List of extracted claims
        """
        claims = []

        # Split into sentences
        sentences = re.split(r'[.!?]+', text)

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            # Check if sentence contains negative assertion
            if self.contains_negative_assertion(sentence):
                claims.append(sentence)

        return claims

    def validate_flagged_snippet(
        self,
        snippet: Dict[str, Any],
        article_date: Optional[str] = None
    ) -> Tuple[bool, Optional[List[Dict[str, Any]]]]:
        """
        Validate a flagged snippet to ensure negative assertions are backed by sources.

        Args:
            snippet: Flagged snippet dictionary with 'text', 'reason', etc.
            article_date: Optional article publication date for context

        Returns:
            Tuple of (is_valid, sources)
            - is_valid: True if snippet is valid (has sources or no negative assertions)
            - sources: List of source dicts if verification was performed, None otherwise
        """
        text = snippet.get('text', '')
        reason = snippet.get('reason', '')
        existing_sources = snippet.get('sources', [])

        # If snippet already has sources, it's valid
        if existing_sources:
            # Normalize to list of dicts
            normalized_sources = []
            for source in existing_sources:
                if isinstance(source, dict):
                    normalized_sources.append(source)
                elif isinstance(source, str):
                    normalized_sources.append({
                        'url': source,
                        'title': 'Verification source',
                        'snippet': '',
                        'source': '',
                        'is_credible': True
                    })
            return True, normalized_sources if normalized_sources else None

        # Check if snippet contains negative assertions
        combined_text = f"{text} {reason}"

        if not self.contains_negative_assertion(combined_text):
            # No negative assertions, snippet is valid
            return True, None

        # Extract claims from the snippet
        claims = self.extract_claims_from_text(text)

        if not claims:
            # Try extracting from reason
            claims = self.extract_claims_from_text(reason)

        if not claims:
            # Fallback: use the entire text as a claim
            claims = [text]

        logger.info(f"Validating negative assertion in snippet: {claims}")

        # Determine if this is a recent news claim
        is_recent = any(self.is_recent_news_claim(claim, article_date) for claim in claims)

        sources = []
        has_verification = False

        try:
            if is_recent:
                # Use web search for recent news
                logger.info(f"Using web search for recent news claim: {claims[0]}")

                # Lazy load web search
                if self.web_search is None:
                    from web_search import get_web_search
                    self.web_search = get_web_search()

                # Search for multiple sources about this topic
                for claim in claims[:2]:  # Limit to first 3 claims to avoid too many searches
                    # Create enhanced query with date context if available
                    search_query = claim
                    if article_date:
                        try:
                            from dateutil import parser as date_parser
                            parsed_date = date_parser.parse(article_date)
                            year_month = parsed_date.strftime("%B %Y")
                            search_query = f"{claim} {year_month}"
                        except:
                            pass

                    # Search for consensus from trusted news sources
                    news_results = self.web_search.search_consensus(search_query)

                    if news_results:
                        # Add all credible sources found
                        sources.extend(news_results)
                        has_verification = True

                        # Also try a general verification search for more sources
                        general_results = self.web_search.search_for_verification(
                            claim,
                            num_results=5,
                            recent_only=True
                        )
                        if general_results:
                            sources.extend(general_results)

                # Remove duplicates by URL
                seen_urls = set()
                unique_sources = []
                for source in sources:
                    url = source.get('url', '')
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        unique_sources.append(source)

                sources = unique_sources[:20]  # Limit to 15 sources

                if has_verification and len(sources) > 0:
                    logger.info(f"Found {len(sources)} web sources for recent claim")
                    return True, sources
                else:
                    logger.warning(f"No web sources found for recent claim: {text}")
                    return False, None

            else:
                # Use fact checker for historical claims
                logger.info(f"Using fact checker for historical claim")
                fact_checker = get_fact_checker()
                fact_check_results = fact_checker.check_claims(claims, max_results_per_claim=3)

                # Collect sources from fact-check results
                source_urls = []
                for result in fact_check_results:
                    if result.sources:
                        source_urls.extend(result.sources)
                        has_verification = True

                    # If claim is marked as Verified or False with high confidence, accept it
                    if result.status in ['Verified', 'False'] and result.confidence >= 0.7:
                        has_verification = True

                if has_verification and source_urls:
                    # Convert URLs to source dicts
                    sources = [{
                        'url': url,
                        'title': 'Fact-check source',
                        'snippet': 'External fact-check verification',
                        'source': '',
                        'is_credible': True
                    } for url in list(set(source_urls))]
                    return True, sources
                else:
                    logger.warning(f"Negative assertion could not be verified: {text}")
                    return False, None

        except Exception as e:
            logger.error(f"Error validating claim: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # On error, reject the snippet to be safe
            return False, None

    def validate_and_enrich_snippets(
        self,
        snippets: List[Dict[str, Any]],
        require_sources: bool = True,
        article_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Validate all flagged snippets and enrich them with sources.

        Args:
            snippets: List of flagged snippet dictionaries
            require_sources: If True, reject snippets with unverified negative assertions
            article_date: Optional article publication date for context

        Returns:
            List of validated and enriched snippets
        """
        validated_snippets = []

        for snippet in snippets:
            is_valid, sources = self.validate_flagged_snippet(snippet, article_date)

            if not is_valid:
                if require_sources:
                    # Skip this snippet - negative assertion without verification
                    logger.info(f"Filtering out unverified negative assertion: {snippet.get('text', '')}")
                    continue
                else:
                    # Keep snippet but mark it as unverified
                    snippet['unverified'] = True
                    snippet['warning'] = 'This claim could not be verified with external sources'

            # Add sources if we found any
            if sources:
                if 'sources' not in snippet or not snippet['sources']:
                    snippet['sources'] = []

                # Extract existing URLs to avoid duplicates
                existing_urls = set()
                for s in snippet['sources']:
                    try:
                        if isinstance(s, dict):
                            url = s.get('url')
                            if url:
                                existing_urls.add(url)
                        elif isinstance(s, str):
                            existing_urls.add(s)
                    except (AttributeError, TypeError):
                        # Skip malformed sources
                        continue

                # Add sources in the expected format (sources are already dicts now)
                for source in sources:
                    if isinstance(source, dict):
                        source_url = source.get('url')
                        if source_url and source_url not in existing_urls:
                            snippet['sources'].append(source)
                            existing_urls.add(source_url)
                    elif isinstance(source, str) and source not in existing_urls:
                        snippet['sources'].append({
                            'url': source,
                            'title': 'Verification source',
                            'snippet': '',
                            'source': '',
                            'is_credible': True
                        })
                        existing_urls.add(source)

            validated_snippets.append(snippet)

        return validated_snippets

    def validate_analysis_result(
        self,
        analysis_result: Dict[str, Any],
        require_sources: bool = True,
        article_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate an entire analysis result, checking all flagged snippets.

        Args:
            analysis_result: Complete analysis result dictionary
            require_sources: If True, filter out unverified negative assertions
            article_date: Optional article publication date for context

        Returns:
            Validated and enriched analysis result
        """
        flagged_snippets = analysis_result.get('flagged_snippets', [])

        if not flagged_snippets:
            return analysis_result

        logger.info(f"Validating {len(flagged_snippets)} flagged snippets for negative assertions...")

        # Validate and enrich snippets
        validated_snippets = self.validate_and_enrich_snippets(
            flagged_snippets,
            require_sources,
            article_date
        )

        # Update the analysis result
        analysis_result['flagged_snippets'] = validated_snippets

        # Add metadata about validation
        if 'metadata' not in analysis_result:
            analysis_result['metadata'] = {}

        analysis_result['metadata']['snippets_validated'] = len(flagged_snippets)
        analysis_result['metadata']['snippets_after_validation'] = len(validated_snippets)
        analysis_result['metadata']['snippets_filtered'] = len(flagged_snippets) - len(validated_snippets)

        logger.info(
            f"Validation complete: {len(validated_snippets)}/{len(flagged_snippets)} snippets passed "
            f"({len(flagged_snippets) - len(validated_snippets)} filtered)"
        )

        return analysis_result


# Singleton instance
_claim_validator_instance: Optional[ClaimValidator] = None


def get_claim_validator() -> ClaimValidator:
    """Get or create the global claim validator instance."""
    global _claim_validator_instance
    if _claim_validator_instance is None:
        _claim_validator_instance = ClaimValidator()
    return _claim_validator_instance
