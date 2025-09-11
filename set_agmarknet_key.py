#!/usr/bin/env python3
"""
Script to set up Agmarknet API key for the ROOTAI application
"""
import os
import sys

def set_agmarknet_api_key():
    """Set the Agmarknet API key environment variable"""
    print("🌾 Agmarknet API Key Setup")
    print("=" * 40)
    
    # Check if API key is already set
    existing_key = os.environ.get('AGMARKNET_API_KEY')
    if existing_key:
        print(f"✅ Agmarknet API key already set: {existing_key[:10]}...")
        return existing_key
    
    # Get API key from user
    print("To get real market data from Agmarknet API:")
    print("1. Visit: https://agmarknet.gov.in/")
    print("2. Register for API access")
    print("3. Get your API key")
    print()
    
    api_key = input("Enter your Agmarknet API key (or press Enter to use mock data): ").strip()
    
    if api_key:
        os.environ['AGMARKNET_API_KEY'] = api_key
        print(f"✅ Set AGRAMARKNET_API_KEY to: {api_key[:10]}...")
        print("You can now run: python run.py")
        return api_key
    else:
        print("⚠️  No API key provided. The app will use mock market data.")
        print("To add your API key later, run this script again.")
        return None

if __name__ == "__main__":
    set_agmarknet_api_key()

