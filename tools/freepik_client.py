"""
Freepik API Client
==================
This script provides an interface to the Freepik API for searching and downloading assets.
It uses credentials from D:\\TechAI\\Credentials\\master_keys.env.

Usage:
    python freepik_client.py --search "query"
    python freepik_client.py --download "resource_id"

Dependencies:
    pip install requests python-dotenv
"""

import os
import sys
import json
import argparse
import requests
from pathlib import Path

# Try to import dotenv, but don't fail if missing (fallback to manual env parsing if needed, 
# but we expect standard environment to have it or we can read manually)
try:
    from dotenv import load_dotenv
except ImportError:
    print("❌ ERROR: python-dotenv not installed. Run: pip install python-dotenv")
    sys.exit(1)

# Configuration
CREDENTIALS_DIR = Path("D:/TechAI/Credentials")
MASTER_KEYS_FILE = CREDENTIALS_DIR / "master_keys.env"
DOWNLOAD_DIR = Path("D:/Images/Freepik")

# Setup environment
if MASTER_KEYS_FILE.exists():
    load_dotenv(MASTER_KEYS_FILE)
else:
    print(f"❌ ERROR: Credentials file not found at {MASTER_KEYS_FILE}")
    sys.exit(1)

API_KEY = os.getenv("FREEPIK_API_KEY")

if not API_KEY:
    print("❌ ERROR: FREEPIK_API_KEY not found in master_keys.env")
    sys.exit(1)

BASE_URL = "https://api.freepik.com/v1"

def search_resources(query, limit=5, page=1):
    """Search for resources on Freepik."""
    url = f"{BASE_URL}/resources"
    headers = {
        "Accept-Language": "en-US",
        "X-Freepik-API-Key": API_KEY
    }
    params = {
        "locale": "en-US",
        "page": page,
        "limit": limit,
        "term": query
    }
    
    try:
        print(f"🔍 Searching Freepik for: '{query}'...")
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        
        data = response.json()
        resources = data.get("data", [])
        
        print(f"✅ Found {len(resources)} resources:")
        for res in resources:
            print(f"   - [{res.get('id')}] {res.get('title')} ({res.get('url')})")
            
        return resources
    except requests.exceptions.RequestException as e:
        print(f"❌ API Error: {e}")
        if response.text:
             print(f"   Response: {response.text}")
        return []

def download_resource(resource_id):
    """
    Attempt to download a resource.
    Note: Freepik API download flow can be complex (requires attribution usually).
    This is a placeholder for the download logic as specific endpoints vary by plan.
    """
    print(f"⚠️ Download functionality for ID {resource_id} is not fully implemented in this v1 script.")
    print("   Please use the URL provided in search results to download manually for now.")

def main():
    parser = argparse.ArgumentParser(description="Freepik API Client")
    parser.add_argument("--search", help="Search query")
    parser.add_argument("--download", help="Resource ID to download")
    
    args = parser.parse_args()
    
    if args.search:
        search_resources(args.search)
    elif args.download:
        download_resource(args.download)
    else:
        parser.print_help()

if __name__ == "__main__":
    if not DOWNLOAD_DIR.exists():
        DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    main()
