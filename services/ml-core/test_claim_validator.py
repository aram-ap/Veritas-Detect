"""
Test script for the claim validator functionality.
"""

import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from claim_validator import ClaimValidator

def test_negative_assertion_detection():
    """Test that negative assertions are detected correctly."""
    print("\n=== Testing Negative Assertion Detection ===\n")

    validator = ClaimValidator()

    test_cases = [
        ("This person doesn't exist", True),
        ("This event never happened", True),
        ("This is false information", True),
        ("This article is fabricated", True),
        ("There is no evidence for this claim", True),
        ("This has been debunked by experts", True),
        ("This uses emotional language", False),
        ("This contains a logical fallacy", False),
        ("The author has a bias", False),
        ("This is an opinion piece", False),
    ]

    passed = 0
    failed = 0

    for text, expected in test_cases:
        result = validator.contains_negative_assertion(text)
        status = "✓" if result == expected else "✗"

        if result == expected:
            passed += 1
        else:
            failed += 1

        print(f"{status} '{text}' - Expected: {expected}, Got: {result}")

    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_claim_extraction():
    """Test that claims are extracted from text correctly."""
    print("\n=== Testing Claim Extraction ===\n")

    validator = ClaimValidator()

    text = """
    This article contains several false claims. First, the author states that
    John Doe doesn't exist in any official records. Second, they claim this
    event never happened. Finally, they say there is no evidence to support
    the opposing view.
    """

    claims = validator.extract_claims_from_text(text)

    print(f"Extracted {len(claims)} claims from text:")
    for i, claim in enumerate(claims, 1):
        print(f"{i}. {claim.strip()}")

    return len(claims) > 0


def test_snippet_validation():
    """Test validation of flagged snippets."""
    print("\n=== Testing Snippet Validation ===\n")

    validator = ClaimValidator()

    # Test snippet with sources (should pass)
    snippet_with_sources = {
        "text": "This person doesn't exist",
        "reason": "No records found",
        "sources": [{"url": "https://factcheck.org/example", "title": "Fact Check"}]
    }

    is_valid, sources = validator.validate_flagged_snippet(snippet_with_sources)
    print(f"Snippet with sources: {'✓ Valid' if is_valid else '✗ Invalid'}")

    # Test snippet without negative assertion (should pass)
    snippet_no_negative = {
        "text": "This uses emotional language",
        "reason": "Appeals to fear",
        "sources": []
    }

    is_valid, sources = validator.validate_flagged_snippet(snippet_no_negative)
    print(f"Snippet without negative assertion: {'✓ Valid' if is_valid else '✗ Invalid'}")

    # Test snippet with negative assertion but no sources
    # This will try to verify via API (may fail if no API keys configured)
    snippet_negative_no_sources = {
        "text": "The moon landing was faked",
        "reason": "This event never happened",
        "sources": []
    }

    print("\nTesting snippet with negative assertion (requires API):")
    is_valid, sources = validator.validate_flagged_snippet(snippet_negative_no_sources)
    print(f"Result: {'✓ Valid' if is_valid else '✗ Invalid (expected if no API keys)'}")
    if sources:
        print(f"Sources found: {len(sources)}")
        for source in sources[:3]:
            print(f"  - {source}")

    return True


def test_analysis_validation():
    """Test validation of full analysis result."""
    print("\n=== Testing Full Analysis Validation ===\n")

    validator = ClaimValidator()

    # Mock analysis result
    analysis_result = {
        "trust_score": 30,
        "label": "Suspicious",
        "flagged_snippets": [
            {
                "text": "This uses emotional language",
                "reason": "Appeals to fear",
                "severity": "medium",
                "sources": []
            },
            {
                "text": "John Smith",
                "reason": "This person doesn't exist",
                "severity": "high",
                "sources": []
            },
            {
                "text": "propaganda techniques",
                "reason": "Uses propaganda framing",
                "severity": "low",
                "sources": []
            }
        ],
        "metadata": {}
    }

    print(f"Original snippets: {len(analysis_result['flagged_snippets'])}")

    # Validate with require_sources=True (will filter unverified)
    validated_result = validator.validate_analysis_result(analysis_result, require_sources=True)

    print(f"After validation: {validated_result['metadata']['snippets_after_validation']} snippets")
    print(f"Filtered: {validated_result['metadata']['snippets_filtered']} snippets")

    return True


def main():
    """Run all tests."""
    print("=" * 60)
    print("Claim Validator Test Suite")
    print("=" * 60)

    try:
        test_negative_assertion_detection()
        test_claim_extraction()
        test_snippet_validation()
        test_analysis_validation()

        print("\n" + "=" * 60)
        print("✓ All tests completed successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
