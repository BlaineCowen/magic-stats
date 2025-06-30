import requests
import pandas as pd

def get_sample():
    # Download the CSV file
    url = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2023.csv"
    print("Downloading play-by-play data...")
    response = requests.get(url)
    
    # Save first few rows to a temporary file
    with open("temp.csv", "wb") as f:
        f.write(response.content)
    
    # Read with pandas to get exact format
    df = pd.read_csv("temp.csv", nrows=5)
    
    # Save to sample file preserving all columns and format
    df.to_csv("samples/pbp_sample.csv", index=False)
    print("Sample saved to samples/pbp_sample.csv")

if __name__ == "__main__":
    get_sample() 