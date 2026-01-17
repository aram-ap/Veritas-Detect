"""
Claim Validator - Intercepts and verifies negative assertions before they're returned.

This module prevents the AI from making unverified claims about things not existing
or being false. It requires all such claims to be backed by external sources.
"""

import re
import logging
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

    def __init__(self):
        """Initialize the claim validator."""
        self.patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.NEGATIVE_CLAIM_PATTERNS]

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

    def validate_flagged_snippet(self, snippet: Dict[str, Any]) -> Tuple[bool, Optional[List[str]]]:
        """
        Validate a flagged snippet to ensure negative assertions are backed by sources.

        Args:
            snippet: Flagged snippet dictionary with 'text', 'reason', etc.

        Returns:
            Tuple of (is_valid, sources)
            - is_valid: True if snippet is valid (has sources or no negative assertions)
            - sources: List of source URLs if verification was performed, None otherwise
        """
        text = snippet.get('text', '')
        reason = snippet.get('reason', '')
        existing_sources = snippet.get('sources', [])

        # If snippet already has sources, it's valid
        if existing_sources:
            return True, existing_sources

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

        # Verify claims with fact checker
        logger.info(f"Validating negative assertion in snippet: {claims}")

        try:
            fact_checker = get_fact_checker()
            fact_check_results = fact_checker.check_claims(claims, max_results_per_claim=3)

            # Collect sources from fact-check results
            sources = []
            has_verification = False

            for result in fact_check_results:
                if result.sources:
                    sources.extend(result.sources)
                    has_verification = True

                # If claim is marked as Verified or False with high confidence, accept it
                if result.status in ['Verified', 'False'] and result.confidence >= 0.7:
                    has_verification = True

            if has_verification:
                # Remove duplicates
                sources = list(set(sources))
                return True, sources
            else:
                # No verification found - snippet should be rejected or marked as unverified
                logger.warning(f"Negative assertion could not be verified: {text}")
                return False, None

        except Exception as e:
            logger.error(f"Error validating claim: {e}")
            # On error, reject the snippet to be safe
            return False, None

    def validate_and_enrich_snippets(
        self,
        snippets: List[Dict[str, Any]],
        require_sources: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Validate all flagged snippets and enrich them with sources.

        Args:
            snippets: List of flagged snippet dictionaries
            require_sources: If True, reject snippets with unverified negative assertions

        Returns:
            List of validated and enriched snippets
        """
        validated_snippets = []

        for snippet in snippets:
            is_valid, sources = self.validate_flagged_snippet(snippet)

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

                # Extract existing URLs to avoid recursion issues
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

                # Add sources in the expected format
                for source_url in sources:
                    if source_url and source_url not in existing_urls:
                        snippet['sources'].append({
                            'url': source_url,
                            'title': 'Fact-check source',
                            'snippet': 'External verification'
                        })
                        existing_urls.add(source_url)  # Track newly added URLs

            validated_snippets.append(snippet)

        return validated_snippets

    def validate_analysis_result(
        self,
        analysis_result: Dict[str, Any],
        require_sources: bool = True
    ) -> Dict[str, Any]:
        """
        Validate an entire analysis result, checking all flagged snippets.

        Args:
            analysis_result: Complete analysis result dictionary
            require_sources: If True, filter out unverified negative assertions

        Returns:
            Validated and enriched analysis result
        """
        flagged_snippets = analysis_result.get('flagged_snippets', [])

        if not flagged_snippets:
            return analysis_result

        logger.info(f"Validating {len(flagged_snippets)} flagged snippets for negative assertions...")

        # Validate and enrich snippets
        validated_snippets = self.validate_and_enrich_snippets(flagged_snippets, require_sources)

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
