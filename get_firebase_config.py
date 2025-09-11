#!/usr/bin/env python3
"""
Quick script to help get Firebase configuration
"""

import json
import os

def get_firebase_config():
    """Extract Firebase config from service account key"""
    try:
        with open('serviceAccountKey.json', 'r') as f:
            service_account = json.load(f)
        
        project_id = service_account.get('project_id', 'esp32---demo-ac37f')
        
        print("🔧 Firebase Configuration Setup")
        print("=" * 50)
        print(f"Project ID: {project_id}")
        print()
        print("To get your Firebase Web App configuration:")
        print("1. Go to: https://console.firebase.google.com/")
        print(f"2. Select project: {project_id}")
        print("3. Click the gear icon (⚙️) → Project Settings")
        print("4. Scroll down to 'Your apps' section")
        print("5. If no web app exists:")
        print("   - Click 'Add app' → Web (</>)")
        print("   - Register with nickname: 'ROOTAI Mobile'")
        print("   - Click 'Register app'")
        print("6. Copy the firebaseConfig object")
        print()
        print("Replace the config in templates/mobile.html with:")
        print("-" * 50)
        print("const firebaseConfig = {")
        print("    apiKey: 'YOUR_ACTUAL_API_KEY',")
        print(f"    authDomain: '{project_id}.firebaseapp.com',")
        print(f"    projectId: '{project_id}',")
        print(f"    storageBucket: '{project_id}.appspot.com',")
        print(f"    messagingSenderId: '{service_account.get('client_id', 'YOUR_SENDER_ID')}',")
        print("    appId: 'YOUR_ACTUAL_APP_ID'")
        print("};")
        print("-" * 50)
        print()
        print("⚠️  IMPORTANT: Also enable these services in Firebase Console:")
        print("1. Authentication → Sign-in method → Enable Email/Password")
        print("2. Firestore Database → Create database → Start in test mode")
        print()
        
    except FileNotFoundError:
        print("❌ serviceAccountKey.json not found!")
        print("Make sure the file exists in the current directory.")
    except json.JSONDecodeError:
        print("❌ Invalid JSON in serviceAccountKey.json!")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    get_firebase_config()



