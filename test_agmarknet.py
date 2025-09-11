#!/usr/bin/env python3
"""
Test script to verify Agmarknet API integration
"""
import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_market_data():
    api_key = os.environ.get('AGMARKNET_API_KEY')
    base_url = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24?api-key=579b464db66ec23bdd000001a603334a929945264bac17304a0b7c3a&format=csv&limit=1000" #direct API key involve here!

    # Try different parameter combinations
    test_cases = [
        {
            'name': 'Maharashtra + Onion',
            'params': {
                'api-key': api_key,
                'format': 'json',
                'limit': 100,
                'filters[state]': 'Maharashtra',
                'filters[commodity]': 'Onion'
            }
        },
        {
            'name': 'No filters (all data)',
            'params': {
                'api-key': api_key,
                'format': 'json',
                'limit': 10
            }
        },
        {
            'name': 'Just Maharashtra',
            'params': {
                'api-key': api_key,
                'format': 'json',
                'limit': 100,
                'filters[state]': 'Maharashtra'
            }
        },
        {
            'name': 'Just Onion',
            'params': {
                'api-key': api_key,
                'format': 'json',
                'limit': 100,
                'filters[commodity]': 'Onion'
            }
        }
    ]

    for test_case in test_cases:
        print(f"\n🔄 Testing: {test_case['name']}")
        try:
            response = requests.get(base_url, params=test_case['params'])
            response.raise_for_status()
            data = response.json()
            
            print(f"Status: {response.status_code}")
            print(f"Response keys: {list(data.keys())}")
            
            if 'records' in data:
                records = data['records']
                print(f"Records found: {len(records)}")
                if records:
                    print(f"Sample record keys: {list(records[0].keys())}")
                    print(f"Sample record: {records[0]}")
                    return records
                else:
                    print("No records in response")
            else:
                print(f"Full response: {data}")
                
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
        except Exception as e:
            print(f"Unexpected error: {e}")
    
    return None

# Example usage
if __name__ == "__main__":
    print("🌾 Testing Agmarknet API with your changes...")
    print("=" * 50)
    
    # Check if API key is set
    api_key = os.environ.get('AGMARKNET_API_KEY')
    if api_key and api_key != 'your_agmarknet_api_key_here':
        print(f"✅ API Key found: {api_key[:10]}...")
        result = get_market_data()
        if result:
            print(f"✅ Successfully fetched {len(result)} records!")
        else:
            print("❌ Failed to fetch data")
    else:
        print("❌ No valid API key found")
