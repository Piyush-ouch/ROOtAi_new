#!/usr/bin/env python3
"""
Script to set up RTDB environment variable for the ROOTAI application
"""
import os
import sys

def set_rtdb_environment():
    """Set the RTDB URL environment variable"""
    rtdb_url = "https://esp32---demo-ac37f-default-rtdb.europe-west1.firebasedatabase.app"
    
    # Set environment variable
    os.environ['FIREBASE_RTDB_URL'] = rtdb_url
    
    print(f"✅ Set FIREBASE_RTDB_URL to: {rtdb_url}")
    print("You can now run: python run.py")
    
    return rtdb_url

if __name__ == "__main__":
    set_rtdb_environment()

