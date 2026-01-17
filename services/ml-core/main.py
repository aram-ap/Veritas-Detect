from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import re

app = FastAPI(title="Veritas ML Service", version="0.1.0")

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    text: str
    title: Optional[str] = None
    url: Optional[str] = None


class FlaggedSnippet(BaseModel):
    text: str
    indices: List[int]
    reason: str


class PredictionResult(BaseModel):
    score: float
    bias: str
    flagged_indices: List[List[int]]


# Simple keyword-based heuristics for demo
SENSATIONAL_WORDS = [
    'shocking', 'unbelievable', 'breaking', 'exclusive', 'secret',
    'they don\'t want you to know', 'mainstream media', 'wake up',
    'bombshell', 'exposed', 'you won\'t believe', 'urgent'
]

LEFT_BIAS_WORDS = [
    'progressive', 'social justice', 'inequality', 'marginalized',
    'systemic', 'climate crisis', 'gun control'
]

RIGHT_BIAS_WORDS = [
    'traditional values', 'border security', 'radical left',
    'patriot', 'freedom', 'second amendment', 'socialist'
]


def analyze_text(text: str) -> tuple[float, str, List[List[int]]]:
    """
    Simple heuristic-based analysis for demo purposes.
    In production, this would use the trained ML model.
    """
    text_lower = text.lower()

    # Start with a neutral score (higher is more trustworthy)
    score = 75.0

    # Check for sensational language
    sensational_count = sum(1 for word in SENSATIONAL_WORDS if word in text_lower)
    score -= sensational_count * 8

    # Check text length (very short or very long articles might be suspicious)
    word_count = len(text.split())
    if word_count < 100:
        score -= 10
    elif word_count > 5000:
        score -= 5

    # Check for excessive punctuation (!!!???)
    exclamation_count = text.count('!')
    question_count = text.count('?')
    if exclamation_count > 5:
        score -= (exclamation_count - 5) * 2
    if question_count > 10:
        score -= (question_count - 10)

    # Check for ALL CAPS words (excluding acronyms)
    caps_words = re.findall(r'\b[A-Z]{4,}\b', text)
    if len(caps_words) > 3:
        score -= len(caps_words) * 2

    # Detect bias
    left_count = sum(1 for word in LEFT_BIAS_WORDS if word in text_lower)
    right_count = sum(1 for word in RIGHT_BIAS_WORDS if word in text_lower)

    if left_count > right_count + 2:
        bias = "left-leaning"
    elif right_count > left_count + 2:
        bias = "right-leaning"
    elif left_count > 0 or right_count > 0:
        bias = "center"
    else:
        bias = "neutral"

    # Clamp score to valid range
    score = max(0, min(100, score))

    # For now, return empty flagged indices (would be filled by actual ML model)
    flagged_indices: List[List[int]] = []

    return score, bias, flagged_indices


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "veritas-ml"}


@app.post("/predict", response_model=PredictionResult)
def predict(request: PredictRequest):
    """
    Analyze text for misinformation and bias.
    Returns a trust score (0-100, higher = more trustworthy) and bias indicator.
    """
    score, bias, flagged_indices = analyze_text(request.text)

    return PredictionResult(
        score=score,
        bias=bias,
        flagged_indices=flagged_indices
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
