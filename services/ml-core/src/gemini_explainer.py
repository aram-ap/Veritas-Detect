import os
import json
import logging
import re
from typing import List, Dict, Optional, Any
from datetime import datetime
import google.generativeai as genai
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
            logger.warning("GEMINI_API_KEY not found. Gemini features will be disabled.")
            print("DEBUG: GeminiExplainer disabled because API key is missing")
            self.enabled = False
        else:
            genai.configure(api_key=self.api_key)
            self.enabled = True
            # Use the specific model requested by user, or fallback
            requested_model = os.getenv("GEMINI_MODEL", model_name)

            print(f"DEBUG: Initializing Gemini with model: {requested_model}")
            try:
                self.model_name = requested_model
                # Initialize model (Google Search grounding enabled via generation config)
                self.model = genai.GenerativeModel(self.model_name)
                print("DEBUG: Gemini model initialized successfully")
            except Exception as e:
                print(f"DEBUG: Failed to initialize requested model {requested_model}: {e}")
                print("DEBUG: Attempting fallback to 'gemini-2.0-flash-exp'...")
                try:
                    self.model_name = "gemini-2.0-flash-exp"
                    self.model = genai.GenerativeModel(self.model_name)
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
                    ] (optional - include if you used Google Search to verify this)
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

        IMPORTANT for verifiable_claims:
        - Extract ONLY specific, factual claims that can be verified through external sources
        - Focus on statements about events, statistics, quotes, dates, or measurable facts
        - Avoid subjective opinions or interpretations
        - Be concise (one sentence per claim)
        - Examples of good claims: "The unemployment rate dropped to 3.5% in December 2024", "President X signed bill Y on January 1st"
        - Limit to top 3-5 most significant claims
        """

        try:
            print(f"DEBUG: Sending request to Gemini ({self.model_name}) with Google Search grounding...")

            # Enable Google Search grounding using the correct tool name
            from google.generativeai.types import Tool
            google_search_tool = Tool(google_search={})

            response = self.model.generate_content(
                prompt,
                tools=[google_search_tool]
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
