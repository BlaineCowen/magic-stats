import pandas as pd
import requests
import io

def download_large_sample():
    """Download a larger sample of play-by-play data for analysis."""
    print("Downloading 2023 play-by-play data for analysis...")
    
    # Download 2023 data (should be a good size for analysis)
    url = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2023.csv"
    
    try:
        # Read first 1000 rows to get a good sample for data type analysis
        df = pd.read_csv(url, nrows=1000, low_memory=False)
        
        print(f"Downloaded {len(df)} rows with {len(df.columns)} columns")
        
        # Save sample for analysis
        df.to_csv('samples/pbp_large_sample.csv', index=False)
        print("Saved large sample to samples/pbp_large_sample.csv")
        
        return df
        
    except Exception as e:
        print(f"Error downloading data: {e}")
        return None

if __name__ == "__main__":
    download_large_sample() 