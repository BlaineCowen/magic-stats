#!/usr/bin/env python3
"""
Script to fetch all nflreadr dictionaries from the NFL API and save as JSON
"""

import requests
import json
import time
from typing import Dict, Any

# API endpoint
API_URL = "http://68.183.98.17:8000/execute"

# All available dictionaries
DICTIONARIES = [
    "dictionary_combine",
    "dictionary_contracts", 
    "dictionary_depth_charts",
    "dictionary_draft_picks",
    "dictionary_espn_qbr",
    "dictionary_ff_opportunity",
    "dictionary_ff_playerids",
    "dictionary_ff_rankings",
    "dictionary_ftn_charting",
    "dictionary_injuries",
    "dictionary_nextgen_stats",
    "dictionary_participation",
    "dictionary_pbp",
    "dictionary_pfr_passing",
    "dictionary_player_stats",
    "dictionary_player_stats_def",
    "dictionary_roster_status",
    "dictionary_rosters",
    "dictionary_schedules",
    "dictionary_snap_counts",
    "dictionary_trades"
]

def get_dictionary(dict_name: str) -> Dict[str, Any]:
    """Get a single dictionary from the API"""
    
    # R code to get the dictionary
    r_code = f"""
    # Load required libraries
    library(nflreadr)
    
    # Get the dictionary
    dict_data <- {dict_name}
    
    # Convert to list for JSON serialization
    dict_data
    """
    
    try:
        response = requests.post(API_URL, json={"code": r_code})
        response.raise_for_status()
        
        result = response.json()
        
        if result.get("success"):
            return {
                "name": dict_name,
                "data": result.get("result", {}),
                "status": "success"
            }
        else:
            return {
                "name": dict_name,
                "error": result.get("error", "Unknown error"),
                "status": "error"
            }
            
    except Exception as e:
        return {
            "name": dict_name,
            "error": str(e),
            "status": "error"
        }

def main():
    """Main function to get all dictionaries"""
    
    print("Fetching nflreadr dictionaries...")
    print(f"API URL: {API_URL}")
    print(f"Total dictionaries: {len(DICTIONARIES)}")
    print("-" * 50)
    
    all_dictionaries = {}
    successful = 0
    failed = 0
    
    for i, dict_name in enumerate(DICTIONARIES, 1):
        print(f"[{i}/{len(DICTIONARIES)}] Fetching {dict_name}...")
        
        result = get_dictionary(dict_name)
        
        if result["status"] == "success":
            all_dictionaries[dict_name] = result["data"]
            successful += 1
            print(f"  ✓ Success")
        else:
            all_dictionaries[dict_name] = {"error": result["error"]}
            failed += 1
            print(f"  ✗ Failed: {result['error']}")
        
        # Small delay to be nice to the API
        time.sleep(0.5)
    
    # Save to JSON file
    output_file = "nflreadr_dictionaries.json"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_dictionaries, f, indent=2, ensure_ascii=False)
    
    print("-" * 50)
    print(f"Results saved to: {output_file}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Total: {len(DICTIONARIES)}")
    
    # Also create a summary file
    summary = {
        "metadata": {
            "total_dictionaries": len(DICTIONARIES),
            "successful": successful,
            "failed": failed,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "api_url": API_URL
        },
        "dictionaries": {
            name: {
                "status": data.get("error") and "error" or "success",
                "error": data.get("error"),
                "columns": list(data.keys()) if isinstance(data, dict) and not data.get("error") else None
            }
            for name, data in all_dictionaries.items()
        }
    }
    
    with open("nflreadr_dictionaries_summary.json", 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"Summary saved to: nflreadr_dictionaries_summary.json")

if __name__ == "__main__":
    main() 