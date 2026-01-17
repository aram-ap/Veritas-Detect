"""
Database of known media bias ratings.
Sources derived from general consensus (e.g. AllSides, AdFontes).
"""

from typing import Dict, Optional
from urllib.parse import urlparse

# Map domains to bias ratings
# Ratings: Left, Left-Center, Center, Right-Center, Right, Satire, Conspiracy
BIAS_DB: Dict[str, str] = {
    # Left
    "cnn.com": "Left",
    "msnbc.com": "Left",
    "huffpost.com": "Left",
    "vox.com": "Left",
    "theguardian.com": "Left",
    "motherjones.com": "Left",
    "salon.com": "Left",
    "slate.com": "Left",
    "democracynow.org": "Left",
    "newyorker.com": "Left",
    "thedailybeast.com": "Left",

    # Left-Center
    "nytimes.com": "Left-Center",
    "washingtonpost.com": "Left-Center",
    "nbcnews.com": "Left-Center",
    "abcnews.go.com": "Left-Center",
    "cbsnews.com": "Left-Center",
    "time.com": "Left-Center",
    "theatlantic.com": "Left-Center",
    "bloomberg.com": "Left-Center",
    "npr.org": "Left-Center",
    
    # Center
    "apnews.com": "Center",
    "reuters.com": "Center",
    "usatoday.com": "Center",
    "bbc.com": "Center",
    "bbc.co.uk": "Center",
    "csmonitor.com": "Center",
    "newsweek.com": "Center",
    "thehill.com": "Center",
    "wsj.com": "Center", # Opinion is right, news is center, usually rated Center overall or Right-Center
    "axios.com": "Center",
    
    # Right-Center
    "washingtonexaminer.com": "Right-Center",
    "nypost.com": "Right-Center",
    "washingtontimes.com": "Right-Center",
    "realclearpolitics.com": "Right-Center",
    "marketwatch.com": "Right-Center",
    "reason.com": "Right-Center",

    # Right
    "foxnews.com": "Right",
    "breitbart.com": "Right",
    "dailywire.com": "Right",
    "thefederalist.com": "Right",
    "newsmax.com": "Right",
    "oann.com": "Right",
    "nationalreview.com": "Right",
    "dailycaller.com": "Right",
    "gatewaypundit.com": "Right",
    "infowars.com": "Conspiracy/Right",
    
    # Satire
    "theonion.com": "Satire",
    "babylonbee.com": "Satire",
}

def get_bias_from_url(url: str) -> Optional[str]:
    """
    Look up bias based on the URL domain.
    Handles subdomains and variations.
    """
    if not url:
        return None
        
    try:
        # Extract hostname
        parsed = urlparse(url)
        hostname = parsed.netloc.lower()
        
        # Remove 'www.'
        if hostname.startswith("www."):
            hostname = hostname[4:]
            
        # Check exact match
        if hostname in BIAS_DB:
            return BIAS_DB[hostname]
            
        # Check parent domain (e.g. politics.cnn.com -> cnn.com)
        parts = hostname.split('.')
        if len(parts) > 2:
            parent = ".".join(parts[-2:])
            if parent in BIAS_DB:
                return BIAS_DB[parent]
                
        return None
        
    except Exception:
        return None
