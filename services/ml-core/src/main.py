"""
FastAPI service for misinformation detection and bias analysis.

This service exposes REST endpoints for analyzing news articles
to detect misinformation and political bias.

Usage:
    uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import sys
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import logging

# Add src to path for imports
sys.path.append(os.path.dirname(__file__))
from inference import predict_full_analysis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Misinformation Detection API",
    description="ML-powered API for detecting misinformation and political bias in news articles",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "http://localhost:3001",
        "https://*.vercel.app",   # Vercel deployments
        "https://*.digitalocean.app",  # DigitalOcean deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response validation
class PredictRequest(BaseModel):
    """Request model for prediction endpoint."""
    text: str = Field(
        ...,
        description="Full article text to analyze",
        min_length=50,
        max_length=50000
    )
    title: Optional[str] = Field(
        None,
        description="Article title (optional)",
        max_length=500
    )
    
    class Config:
        schema_extra = {
            "example": {
                "text": "This is a sample news article text that needs to be analyzed for misinformation...",
                "title": "Breaking: Important News Story"
            }
        }


class FlaggedSnippet(BaseModel):
    """Model for a flagged suspicious text snippet."""
    text: str = Field(..., description="The suspicious text snippet")
    index: List[int] = Field(..., description="[start, end] character indices")
    reason: str = Field(..., description="Reason why this snippet is flagged")
    confidence: Optional[float] = Field(None, description="Confidence score (0-1)")


class PredictionResponse(BaseModel):
    """Response model for prediction endpoint."""
    trust_score: int = Field(
        ...,
        description="Trust score from 0-100 (100 = trustworthy, 0 = fake)",
        ge=0,
        le=100
    )
    label: str = Field(
        ...,
        description="Classification label: 'Likely True', 'Suspicious', or 'Likely Fake'"
    )
    bias: str = Field(
        ...,
        description="Political bias: 'Left', 'Left-Center', 'Center', 'Right-Center', or 'Right'"
    )
    flagged_snippets: List[FlaggedSnippet] = Field(
        default=[],
        description="List of suspicious text snippets with highlighting info"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "trust_score": 85,
                "label": "Likely True",
                "bias": "Left-Center",
                "flagged_snippets": [
                    {
                        "text": "shocking discovery",
                        "index": [120, 138],
                        "reason": "Sensationalist language",
                        "confidence": 0.85
                    }
                ]
            }
        }


class HealthResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str
    message: str
    model_loaded: bool


# Global predictor instance (loaded on startup)
predictor_loaded = False


@app.on_event("startup")
async def startup_event():
    """Initialize the ML model on startup."""
    global predictor_loaded
    
    try:
        logger.info("Starting up FastAPI service...")
        logger.info("Checking for trained model...")
        
        # Check if model exists
        model_path = "models/misinfo_model.pkl"
        if not os.path.exists(model_path):
            logger.warning(
                f"Model not found at {model_path}. "
                "Please train the model using: python src/training.py"
            )
            predictor_loaded = False
        else:
            # Try to load the model by calling the inference function once
            logger.info("Loading model...")
            # This will initialize the MisinfoPredictor class
            test_result = predict_full_analysis("test", "test")
            predictor_loaded = True
            logger.info("Model loaded successfully!")
            
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        predictor_loaded = False


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Misinformation Detection API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint to verify service status.
    
    Returns:
        Service health status and model availability
    """
    return {
        "status": "healthy" if predictor_loaded else "degraded",
        "message": "Service is running" if predictor_loaded else "Model not loaded",
        "model_loaded": predictor_loaded
    }


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
async def predict(request: PredictRequest):
    """
    Analyze text for misinformation and political bias.
    
    This endpoint takes article text (and optionally a title) and returns:
    - Trust score (0-100)
    - Classification label (Likely True/Suspicious/Likely Fake)
    - Political bias detection
    - Highlighted suspicious snippets with reasons
    
    Args:
        request: PredictRequest containing text and optional title
        
    Returns:
        PredictionResponse with analysis results
        
    Raises:
        HTTPException: If model is not loaded or analysis fails
    """
    # Check if model is loaded
    if not predictor_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML model not loaded. Please train the model first using: python src/training.py"
        )
    
    try:
        logger.info(f"Processing prediction request for text of length {len(request.text)}")
        
        # Run full analysis
        result = predict_full_analysis(request.text, request.title)
        
        logger.info(
            f"Prediction complete: trust_score={result['trust_score']}, "
            f"label={result['label']}, bias={result['bias']}"
        )
        
        return PredictionResponse(**result)
        
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@app.post("/batch-predict", tags=["Prediction"])
async def batch_predict(texts: List[str]):
    """
    Analyze multiple texts in a single request (batch processing).
    
    Args:
        texts: List of article texts to analyze
        
    Returns:
        List of prediction results
        
    Raises:
        HTTPException: If model is not loaded or batch size exceeds limit
    """
    if not predictor_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML model not loaded"
        )
    
    # Limit batch size
    if len(texts) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch size cannot exceed 10 texts"
        )
    
    try:
        results = []
        for text in texts:
            result = predict_full_analysis(text)
            results.append(result)
        
        return {"predictions": results, "count": len(results)}
        
    except Exception as e:
        logger.error(f"Batch prediction failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch analysis failed: {str(e)}"
        )


@app.get("/model-info", tags=["Info"])
async def model_info():
    """
    Get information about the loaded model.
    
    Returns:
        Model metadata and configuration
    """
    if not predictor_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML model not loaded"
        )
    
    return {
        "model_type": "PassiveAggressiveClassifier with TF-IDF",
        "features": "TF-IDF with unigrams, bigrams, and trigrams",
        "max_features": 10000,
        "training_dataset": "Misinformation Fake News Text Dataset (79k samples)",
        "bias_detection": "Keyword-based political bias analysis",
        "supported_languages": ["English"]
    }


# Error handlers
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    """Handle ValueError exceptions."""
    logger.error(f"ValueError: {str(exc)}")
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(exc)
    )


if __name__ == "__main__":
    import uvicorn
    
    # Run the service
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
