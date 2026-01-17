# Dataset Setup Guide

This guide explains how to properly set up the Kaggle dataset for the ML Core service.

## Dataset Information

- **Source**: [Misinformation Fake News Text Dataset (79k)](https://www.kaggle.com/datasets/stevenpeutz/misinformation-fake-news-text-dataset-79k)
- **Total Samples**: ~79,000 news articles
- **Format**: Two separate CSV files
- **Size**: ~150-200 MB total

## Dataset Structure

The dataset comes in **two separate files**:

### 1. DataSet_Misinfo_FAKE.csv
- Contains fake/misleading news articles
- ~39,000 samples
- Will be labeled as `0` (Fake)

### 2. DataSet_Misinfo_TRUE.csv
- Contains real/verified news articles
- ~40,000 samples
- Will be labeled as `1` (True)

### Columns (typical structure):
- `title` - Article headline
- `text` - Full article content
- `subject` - Topic category (optional)
- `date` - Publication date (optional)

## Step-by-Step Setup

### Step 1: Download from Kaggle

1. **Create Kaggle Account** (if you don't have one)
   - Go to https://www.kaggle.com
   - Sign up for free

2. **Access the Dataset**
   - Visit: https://www.kaggle.com/datasets/stevenpeutz/misinformation-fake-news-text-dataset-79k
   - Accept the dataset terms

3. **Download**
   - Click the "Download" button
   - You'll get a ZIP file containing two CSV files

4. **Extract**
   - Unzip the downloaded file
   - You should see:
     - `DataSet_Misinfo_FAKE.csv`
     - `DataSet_Misinfo_TRUE.csv`

### Step 2: Place Files in Correct Location

```bash
# Navigate to your project
cd services/ml-core

# Create data directory if it doesn't exist
mkdir -p data

# Move/Copy the two CSV files to data/
cp /path/to/downloads/DataSet_Misinfo_FAKE.csv data/
cp /path/to/downloads/DataSet_Misinfo_TRUE.csv data/
```

Your directory should look like:
```
services/ml-core/
├── data/
│   ├── DataSet_Misinfo_FAKE.csv  ← 39k fake articles
│   └── DataSet_Misinfo_TRUE.csv  ← 40k real articles
└── ...
```

### Step 3: Prepare the Combined Dataset

Run the preparation script:

```bash
python scripts/prepare_dataset.py
```

**What this script does:**
1. ✅ Loads both CSV files
2. ✅ Adds label column (0=Fake, 1=True)
3. ✅ Combines into single dataframe
4. ✅ Shuffles the data (important!)
5. ✅ Saves to `data/dataset.csv`
6. ✅ Shows statistics and sample

**Expected Output:**
```
==========================================
Dataset Preparation Script
==========================================

✓ Found: data/DataSet_Misinfo_FAKE.csv
✓ Found: data/DataSet_Misinfo_TRUE.csv

Loading FAKE dataset...
  Loaded 39000 fake news articles
  Columns: ['title', 'text', 'subject', 'date']

Loading TRUE dataset...
  Loaded 40000 real news articles
  Columns: ['title', 'text', 'subject', 'date']

Adding labels...
  Fake articles: label = 0
  True articles: label = 1

Combining datasets...
  Total articles: 79000

Shuffling dataset...
  ✓ Dataset shuffled

Dataset Statistics:
----------------------------------------
  Total samples: 79000
  Fake (label=0): 39000 (49.4%)
  True (label=1): 40000 (50.6%)
  Columns: ['title', 'text', 'subject', 'date', 'label']

Saving combined dataset to data/dataset.csv...
  ✓ Dataset saved successfully!
  File size: 165.23 MB

==========================================
Dataset Preparation Complete!
==========================================

Next step: Train the model
  python src/training.py
```

### Step 4: Verify

Check that the combined dataset exists:

```bash
ls -lh data/dataset.csv
# Should show: ~150-200 MB file
```

## Alternative: Using Kaggle API

If you prefer command-line download:

```bash
# Install Kaggle CLI
pip install kaggle

# Configure API key (create at kaggle.com/settings)
mkdir -p ~/.kaggle
# Place your kaggle.json in ~/.kaggle/

# Download dataset
kaggle datasets download -d stevenpeutz/misinformation-fake-news-text-dataset-79k

# Unzip
unzip misinformation-fake-news-text-dataset-79k.zip -d data/

# Prepare
python scripts/prepare_dataset.py
```

## Troubleshooting

### Issue: "Dataset files not found"

**Solution:**
```bash
# Check if files exist
ls -la data/

# Make sure files are named correctly:
# - DataSet_Misinfo_FAKE.csv
# - DataSet_Misinfo_TRUE.csv

# Check for common naming issues
ls data/ | grep -i dataset
```

### Issue: "Encoding errors when loading CSV"

**Solution:**
The script handles encoding automatically, but if issues persist:
```python
# Edit scripts/prepare_dataset.py
# Change: pd.read_csv(fake_file)
# To: pd.read_csv(fake_file, encoding='latin-1')
```

### Issue: "Memory errors during preparation"

**Solution:**
```bash
# Process in chunks (for low-memory systems)
# The script is optimized, but if needed:
# - Close other applications
# - Use a machine with at least 4GB RAM
```

### Issue: "Columns not found"

The script automatically detects column names, but typical names are:
- `text` or `content` or `article` → Article text
- `label` or `class` or `target` → Label (added by script)
- `title` or `headline` → Title (optional)

## Next Steps

After preparing the dataset:

1. **Train the Model**
   ```bash
   python src/training.py
   ```

2. **Start the Service**
   ```bash
   uvicorn src.main:app --reload
   ```

3. **Test the API**
   ```bash
   curl http://localhost:8000/health
   ```

## Dataset Statistics

After preparation, you should see:

- **Total Samples**: 79,000
- **Class Balance**: ~50/50 (Fake vs Real)
- **Average Text Length**: ~500-1000 words
- **Languages**: English
- **Time Period**: Various (check date column)

## Data Quality Notes

✅ **Good**:
- Large dataset size (79k samples)
- Balanced classes (50/50 split)
- Real-world articles
- Diverse topics

⚠️ **Considerations**:
- Dataset may have biases
- Some articles might be outdated
- Model trained on this data works best for English news
- Performance may vary on very short/long articles

## Privacy & Ethics

- ✅ Dataset is publicly available on Kaggle
- ✅ Used for research/educational purposes
- ⚠️ Do not use predictions as sole source of truth
- ⚠️ Always verify important claims independently

## Support

If you encounter issues:
1. Check the [QUICKSTART.md](QUICKSTART.md)
2. Review [README.md](README.md) troubleshooting section
3. Ensure you have Python 3.10+ and required dependencies

---

**Ready to train?** Run `python src/training.py` after dataset preparation!
