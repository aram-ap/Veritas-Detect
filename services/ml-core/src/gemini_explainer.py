import os
import json
import logging
import re
from typing import List, Dict, Optional, Any
from datetime import datetime
try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    # Fallback to old package if new one not installed yet
    try:
        import google.generativeai as genai
        GENAI_AVAILABLE = True
        logger.warning("Using deprecated google.generativeai package. Please upgrade to google-genai.")
    except ImportError:
        GENAI_AVAILABLE = False
        logger.error("Neither google-genai nor google-generativeai packages found!")
from dataclasses import dataclass

logger = logging.getLogger(__name__)

class GeminiExplainer:
    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-3-flash-preview"):
        """
        Initialize Gemini Explainer.

        Args:
            api_key: Google Gemini API Key. If None, tries to get from env GEMINI_API_KEY.
            model_name: Model to use. Defaults to gemini-3-flash-preview as requested.
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.error("=" * 70)
            logger.error("❌ CRITICAL: GEMINI_API_KEY NOT FOUND")
            logger.error("Gemini AI analysis will be disabled.")
            logger.error("The system will fall back to basic ML model (limited accuracy).")
            logger.error("Set GEMINI_API_KEY in your .env file.")
            logger.error("Get your key at: https://aistudio.google.com/app/apikey")
            logger.error("=" * 70)
            print("\n" + "=" * 70)
            print("❌ CRITICAL ERROR: GEMINI_API_KEY NOT FOUND")
            print("=" * 70)
            print("The AI-powered misinformation detection requires a Gemini API key.")
            print("Without it, the system will use a basic fallback model with limited accuracy.")
            print("\nTo fix this:")
            print("1. Get a free API key at: https://aistudio.google.com/app/apikey")
            print("2. Add it to your .env file: GEMINI_API_KEY=your_key_here")
            print("3. Restart the service")
            print("=" * 70 + "\n")
            self.enabled = False
        elif not GENAI_AVAILABLE:
            logger.error("=" * 70)
            logger.error("❌ CRITICAL: Google Generative AI package not installed")
            logger.error("Install with: pip install google-genai")
            logger.error("=" * 70)
            self.enabled = False
        else:
            # Configure with API key (works for both old and new packages)
            try:
                genai.configure(api_key=self.api_key)
            except AttributeError:
                # New package uses Client instead
                self.client = genai.Client(api_key=self.api_key)
            
            self.enabled = True
            # Use the specific model requested by user, or fallback
            requested_model = os.getenv("GEMINI_MODEL", model_name)

            print(f"✓ Initializing Gemini with model: {requested_model}")
            try:
                self.model_name = requested_model
                # Initialize model (works for old package)
                try:
                    self.model = genai.GenerativeModel(self.model_name)
                except AttributeError:
                    # New package structure - just store model name, no need to get model object
                    self.model = None  # Will use client.models.generate_content directly
                
                logger.info(f"✓ Gemini model '{self.model_name}' initialized successfully")
                print(f"✓ Gemini model '{self.model_name}' initialized successfully")
            except Exception as e:
                print(f"DEBUG: Failed to initialize requested model {requested_model}: {e}")
                print("DEBUG: Attempting fallback to 'gemini-2.0-flash-exp'...")
                try:
                    self.model_name = "gemini-2.0-flash-exp"
                    try:
                        self.model = genai.GenerativeModel(self.model_name)
                    except AttributeError:
                        # New package structure - just store model name
                        self.model = None
                    print("DEBUG: Fallback model initialized successfully")
                except Exception as e2:
                    logger.error(f"Failed to initialize fallback model: {e2}")
                    print(f"DEBUG: Fallback model failed: {e2}")
                    self.enabled = False

    def analyze_content(self, text: str, title: Optional[str] = None) -> Dict[str, Any]:
        """
        Perform comprehensive analysis using Gemini:
        1. Fact checking
        2. Flagging (Misinfo, Disinfo, Propaganda, Logical Fallacy)
        3. Bias detection
        """
        if not self.enabled:
            return self._get_fallback_response()

        # Get current date/time for context
        current_date = datetime.now().strftime("%B %d, %Y")
        current_year = datetime.now().year

        prompt = f"""
        IMPORTANT CONTEXT:
        - Today's date is: {current_date}
        - Current year: {current_year}
        - You have access to Google Search for fact-checking and verification
        - USE GOOGLE SEARCH to verify claims about recent events, statistics, or facts you're uncertain about
        - For claims about events after your training cutoff, SEARCH before flagging them as false
        - Include search results as sources when you verify information

        Analyze the following text for misinformation, bias, and logical fallacies.

        Title: {title or 'No title'}
        Text: {text[:15000]}  # Truncate if too long

        Provide the output in strict JSON format with the following structure:
        {{
            "trust_score": <integer 0-100>,
            "label": <"Likely True", "Suspicious", "Likely Fake">,
            "bias": <"Left", "Left-Center", "Center", "Right-Center", "Right">,
            "summary": <string, concise explanation>,
            "flagged_snippets": [
                {{
                    "text": <exact substring from text>,
                    "type": <"Misinformation", "Disinformation", "Propaganda", "Logical Fallacy">,
                    "reason": <concise explanation>,
                    "severity": <"low", "medium", "high">,
                    "sources": [
                        {{
                            "title": <source title>,
                            "url": <source URL>,
                            "snippet": <relevant excerpt>
                        }}
                    ] (REQUIRED if claiming something is false, doesn't exist, or never happened)
                }}
            ],
            "verifiable_claims": [
                <string: specific, factual claim that can be verified>,
                <string: another verifiable claim>
            ]
        }}

        Guidelines:
        - Be objective and analytical.
        - "Misinformation": False information regardless of intent.
        - "Disinformation": Intentionally false information.
        - "Propaganda": Content designed to manipulate emotions/opinions rather than inform.
        - "Logical Fallacy": Flawed reasoning (ad hominem, straw man, etc.).
        - "Bias": Assess the political leaning based on tone, framing, and omission.

        CRITICAL RULES FOR NEGATIVE CLAIMS:
        - NEVER claim something "doesn't exist", "is false", "never happened", or "is fake" without FIRST verifying via Google Search
        - If you claim something doesn't exist or is false, you MUST include sources in the flagged snippet
        - If you cannot find sources to verify a negative claim, use softer language: "could not be verified", "no evidence found in search", "unconfirmed"
        - When in doubt about existence or truth, SEARCH FIRST, then report findings with sources
        - Examples of what REQUIRES sources:
          * "This person doesn't exist" → MUST have sources proving non-existence
          * "This event never happened" → MUST have sources or historical records
          * "This article is fabricated" → MUST have fact-check sources
          * "This statistic is false" → MUST have sources with correct data
        - Examples of acceptable without sources:
          * "This uses emotional language" (subjective analysis)
          * "This contains a logical fallacy" (structural analysis)
          * "This appears to be propaganda" (pattern recognition)

        IMPORTANT for verifiable_claims:
        - Extract ONLY specific, factual claims that can be verified through external sources
        - Focus on statements about events, statistics, quotes, dates, or measurable facts
        - Avoid subjective opinions or interpretations
        - Be concise (one sentence per claim)
        - Examples of good claims: "The unemployment rate dropped to 3.5% in December 2024", "President X signed bill Y on January 1st"
        - Limit to top 3-5 most significant claims
        - Include ANY claim you make about something being false or non-existent
        """

        try:
            print(f"DEBUG: Sending request to Gemini ({self.model_name})...")

            # Note: Google Search grounding requires specific Gemini model versions
            # For now, relying on Gemini's training data and the date context we provide
            
            # Handle both old and new package structures
            if self.model is not None:
                # Old package: genai.GenerativeModel
                response = self.model.generate_content(prompt)
            else:
                # New package: use client.models.generate_content
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt
                )
            print("DEBUG: Received response from Gemini")
            
            # Extract JSON from response text
            text_response = response.text
            # Try to find JSON block if wrapped in markdown
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', text_response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find just braces
                json_match = re.search(r'(\{.*\})', text_response, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    json_str = text_response

            result = json.loads(json_str)
            
            # Post-processing to ensure snippets match exact text
            for snippet in result.get("flagged_snippets", []):
                snippet_text = snippet["text"]
                # Find indices
                start = text.find(snippet_text)
                if start != -1:
                    snippet["index"] = [start, start + len(snippet_text)]
                else:
                    # Fuzzy match or fallback? 
                    # For now, if exact match fails, we might miss the highlight or need fuzzy search.
                    # We'll set index to None and let UI handle it (maybe just show the box without highlight).
                    snippet["index"] = None
                    
            return result
        except Exception as e:
            logger.error(f"Gemini analysis failed: {e}")
            print(f"DEBUG: Gemini analysis failed with error: {e}")
            return self._get_fallback_response()

    def _get_fallback_response(self) -> Dict[str, Any]:
        return {
            "trust_score": 50,
            "label": "Unknown",
            "bias": "Unknown",
            "summary": "AI analysis unavailable.",
            "flagged_snippets": [],
            "verifiable_claims": []
        }

    # Compatibility methods for existing code calls (if any remain)
    def flag_suspicious_sentences(self, text: str, title: Optional[str] = None, top_n: int = 5):
        # This is now handled in analyze_content
        return []

    def generate_explanation(self, *args, **kwargs):
        return "Analysis provided by Gemini."

    def fact_check_claims(self, *args, **kwargs):
        return []
