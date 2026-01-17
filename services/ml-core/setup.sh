#!/bin/bash

###############################################################################
# ML Core Setup Script
# 
# This script automates the setup process for the ML Core service
###############################################################################

set -e  # Exit on error

echo "=========================================="
echo "ML Core Service - Setup Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python version
echo "Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
REQUIRED_VERSION="3.10"

echo "Python version: $PYTHON_VERSION"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then 
    echo -e "${YELLOW}Warning: Python 3.10+ recommended (you have $PYTHON_VERSION)${NC}"
fi

# Create necessary directories
echo ""
echo "Creating directory structure..."
mkdir -p data
mkdir -p models
mkdir -p logs
echo -e "${GREEN}✓ Directories created${NC}"

# Create virtual environment
echo ""
echo "Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${YELLOW}Virtual environment already exists${NC}"
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1
echo -e "${GREEN}✓ Pip upgraded${NC}"

# Install dependencies
echo ""
echo "Installing Python dependencies..."
pip install -r requirements.txt
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Copy .env file
echo ""
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}Note: Please edit .env with your configuration${NC}"
else
    echo -e "${YELLOW}.env file already exists${NC}"
fi

# Check for dataset files
echo ""
echo "Checking for dataset files..."

# Check for the two separate dataset files
if [ -f "data/DataSet_Misinfo_FAKE.csv" ] && [ -f "data/DataSet_Misinfo_TRUE.csv" ]; then
    echo -e "${GREEN}✓ Found DataSet_Misinfo_FAKE.csv${NC}"
    echo -e "${GREEN}✓ Found DataSet_Misinfo_TRUE.csv${NC}"
    
    # Check if combined dataset already exists
    if [ ! -f "data/dataset.csv" ]; then
        echo ""
        echo "Combining dataset files..."
        python scripts/prepare_dataset.py
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Dataset combined successfully${NC}"
        else
            echo -e "${RED}✗ Dataset combination failed${NC}"
        fi
    else
        echo -e "${GREEN}✓ Combined dataset already exists${NC}"
    fi
elif [ -f "data/dataset.csv" ]; then
    echo -e "${GREEN}✓ Combined dataset found${NC}"
else
    echo -e "${RED}✗ Dataset files not found${NC}"
    echo ""
    echo "Please download the dataset:"
    echo "1. Go to: https://www.kaggle.com/datasets/stevenpeutz/misinformation-fake-news-text-dataset-79k"
    echo "2. Download the dataset (contains two CSV files)"
    echo "3. Place them in data/ folder:"
    echo "   - data/DataSet_Misinfo_FAKE.csv"
    echo "   - data/DataSet_Misinfo_TRUE.csv"
    echo ""
    echo "Then run: python scripts/prepare_dataset.py"
    echo "Finally: python src/training.py"
    echo ""
fi

# If dataset.csv exists, ask about training
if [ -f "data/dataset.csv" ]; then
    # Ask if user wants to train now
    echo ""
    read -p "Dataset ready. Do you want to train the model now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "Training model (this may take a few minutes)..."
        python src/training.py
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Model trained successfully${NC}"
        else
            echo -e "${RED}✗ Model training failed${NC}"
        fi
    fi
fi

# Check for model
echo ""
echo "Checking for trained model..."
if [ -f "models/misinfo_model.pkl" ]; then
    echo -e "${GREEN}✓ Trained model found${NC}"
    MODEL_SIZE=$(ls -lh models/misinfo_model.pkl | awk '{print $5}')
    echo "Model size: $MODEL_SIZE"
else
    echo -e "${YELLOW}! Model not found - train it using: python src/training.py${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Activate virtual environment:"
echo "   source venv/bin/activate"
echo ""
echo "2. If you haven't downloaded the dataset yet:"
echo "   - Download from Kaggle"
echo "   - Place in data/ folder"
echo "   - Run: python scripts/prepare_dataset.py"
echo ""
echo "3. If you haven't trained the model yet:"
echo "   python src/training.py"
echo ""
echo "4. Run the service:"
echo "   uvicorn src.main:app --reload"
echo ""
echo "5. Or use Docker Compose:"
echo "   docker-compose up"
echo ""
echo "6. Access the API:"
echo "   http://localhost:8000/docs"
echo ""
echo -e "${GREEN}Happy coding!${NC}"
echo ""
