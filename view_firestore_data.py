#!/usr/bin/env python3
"""
Script to view Firestore data for debugging
"""

import json
import os
from datetime import datetime

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    # Initialize Firebase
    if not firebase_admin._apps:
        cred = credentials.Certificate('serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    
    print("🔍 Firestore Data Viewer")
    print("=" * 50)
    
    # List all collections
    collections = db.collections()
    print("📁 Available Collections:")
    for collection in collections:
        print(f"  - {collection.id}")
    print()
    
    # Check fields collection
    print("🌾 Fields Collection:")
    print("-" * 30)
    fields_ref = db.collection('fields')
    fields = fields_ref.stream()
    
    field_count = 0
    for field in fields:
        field_count += 1
        field_data = field.to_dict()
        print(f"Field {field_count}:")
        print(f"  ID: {field.id}")
        print(f"  User ID: {field_data.get('userId', 'N/A')}")
        print(f"  Name: {field_data.get('fieldName', 'N/A')}")
        print(f"  Created: {field_data.get('createdAt', 'N/A')}")
        
        # Parse boundary if it exists
        boundary = field_data.get('boundary')
        if boundary:
            try:
                if isinstance(boundary, str):
                    boundary_data = json.loads(boundary)
                else:
                    boundary_data = boundary
                print(f"  Boundary Type: {boundary_data.get('type', 'N/A')}")
                if 'coordinates' in boundary_data:
                    coords = boundary_data['coordinates'][0] if boundary_data['coordinates'] else []
                    print(f"  Coordinates: {len(coords)} points")
                    if coords:
                        print(f"    First point: {coords[0]}")
                        print(f"    Last point: {coords[-1]}")
            except:
                print(f"  Boundary: {str(boundary)[:100]}...")
        
        # Hardware location
        hw_location = field_data.get('hardwareLocation')
        if hw_location:
            print(f"  Hardware Location: {hw_location.latitude}, {hw_location.longitude}")
        
        print()
    
    if field_count == 0:
        print("  No fields found in Firestore")
        print("  This is normal if no user has saved fields yet")
    
    print()
    
    # Check sensor readings
    print("📊 Sensor Readings Collection:")
    print("-" * 30)
    try:
        readings_ref = db.collection('sensorReadings')
        readings = readings_ref.limit(5).stream()
        
        reading_count = 0
        for reading in readings:
            reading_count += 1
            reading_data = reading.to_dict()
            print(f"Reading {reading_count}:")
            print(f"  ID: {reading.id}")
            print(f"  User ID: {reading_data.get('userId', 'N/A')}")
            print(f"  Timestamp: {reading_data.get('timestamp', 'N/A')}")
            print(f"  Environment: {reading_data.get('environment', {})}")
            print()
        
        if reading_count == 0:
            print("  No sensor readings found")
    except Exception as e:
        print(f"  Error reading sensor data: {e}")
    
    print()
    print("💡 To view data in Firebase Console:")
    print("1. Go to: https://console.firebase.google.com/")
    print("2. Select project: esp32---demo-ac37f")
    print("3. Go to Firestore Database")
    print("4. You'll see collections: fields, sensorReadings, etc.")
    print()
    print("🔧 To test field saving:")
    print("1. Open your mobile app: http://localhost:5000/mobile")
    print("2. Sign up/login with a test account")
    print("3. Draw a field on the map")
    print("4. Click 'Save Field'")
    print("5. Run this script again to see the new field")

except ImportError:
    print("❌ Firebase libraries not installed!")
    print("Run: pip install firebase-admin")
except FileNotFoundError:
    print("❌ serviceAccountKey.json not found!")
    print("Make sure the Firebase service account key is in the current directory")
except Exception as e:
    print(f"❌ Error: {e}")



