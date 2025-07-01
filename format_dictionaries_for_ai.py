#!/usr/bin/env python3
"""
Format nflreadr dictionaries for easy copying into AI prompts
"""

import json

def format_dictionary_for_ai(dict_name: str, dict_data: dict) -> str:
    """Format a single dictionary for AI consumption"""
    
    if "error" in dict_data:
        return f"# {dict_name}: ERROR - {dict_data['error']}\n"
    
    # Handle different column formats
    if "field" in dict_data and "data_type" in dict_data and "description" in dict_data:
        fields = dict_data["field"]
        types = dict_data["data_type"]
        descriptions = dict_data["description"]
        
        formatted = f"# {dict_name}\n"
        formatted += "# Field | Type | Description\n"
        formatted += "# ----- | ---- | -----------\n"
        
        for i in range(len(fields)):
            field = fields[i] if i < len(fields) else ""
            dtype = types[i] if i < len(types) else ""
            desc = descriptions[i] if i < len(descriptions) else ""
            formatted += f"# {field} | {dtype} | {desc}\n"
        
        return formatted + "\n"
    
    elif "Field" in dict_data and "Description" in dict_data:
        fields = dict_data["Field"]
        descriptions = dict_data["Description"]
        types = dict_data.get("Type", [""] * len(fields))
        
        formatted = f"# {dict_name}\n"
        formatted += "# Field | Type | Description\n"
        formatted += "# ----- | ---- | -----------\n"
        
        for i in range(len(fields)):
            field = fields[i] if i < len(fields) else ""
            dtype = types[i] if i < len(types) else ""
            desc = descriptions[i] if i < len(descriptions) else ""
            formatted += f"# {field} | {dtype} | {desc}\n"
        
        return formatted + "\n"
    
    else:
        # Handle other formats
        formatted = f"# {dict_name}\n"
        formatted += "# Available fields:\n"
        for key, value in dict_data.items():
            if isinstance(value, list):
                formatted += f"# {key}: {', '.join(str(v) for v in value[:5])}"
                if len(value) > 5:
                    formatted += f" ... and {len(value) - 5} more"
                formatted += "\n"
            else:
                formatted += f"# {key}: {value}\n"
        return formatted + "\n"

def main():
    """Main function to format all dictionaries"""
    
    # Load the dictionaries
    with open("nflreadr_dictionaries.json", 'r', encoding='utf-8') as f:
        dictionaries = json.load(f)
    
    # Format for AI
    ai_formatted = "# NFLREADR DATA DICTIONARIES\n"
    ai_formatted += "# =========================\n\n"
    ai_formatted += "# This document contains all available fields and their descriptions for nflreadr datasets.\n"
    ai_formatted += "# Use this reference when helping users query NFL data.\n\n"
    
    # Add each dictionary
    for dict_name, dict_data in dictionaries.items():
        ai_formatted += format_dictionary_for_ai(dict_name, dict_data)
    
    # Save to file
    with open("nflreadr_dictionaries_ai.txt", 'w', encoding='utf-8') as f:
        f.write(ai_formatted)
    
    print("Formatted dictionaries saved to: nflreadr_dictionaries_ai.txt")
    print(f"Total dictionaries: {len(dictionaries)}")
    
    # Also create a compact version for system prompts
    compact = "# NFLREADR DATASETS\n"
    compact += "# Available datasets and their key fields:\n\n"
    
    for dict_name, dict_data in dictionaries.items():
        if "error" not in dict_data:
            if "field" in dict_data:
                fields = dict_data["field"]
                compact += f"# {dict_name}: {', '.join(fields[:10])}"
                if len(fields) > 10:
                    compact += f" ... ({len(fields)} total fields)"
                compact += "\n"
            elif "Field" in dict_data:
                fields = dict_data["Field"]
                compact += f"# {dict_name}: {', '.join(fields[:10])}"
                if len(fields) > 10:
                    compact += f" ... ({len(fields)} total fields)"
                compact += "\n"
    
    with open("nflreadr_datasets_compact.txt", 'w', encoding='utf-8') as f:
        f.write(compact)
    
    print("Compact version saved to: nflreadr_datasets_compact.txt")

if __name__ == "__main__":
    main() 