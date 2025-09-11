#!/usr/bin/env python3
"""
ROOTAI Precision Agriculture Platform - Startup Script
"""

import os
import sys
from app import app

def main():
    """Start the Flask application"""
    print("Starting ROOTAI Precision Agriculture Platform...")
    print("=" * 50)
    
    # Check if Firebase credentials exist
    if not os.path.exists('serviceAccountKey.json'):
        print("⚠ WARNING: Firebase credentials file not found!")
        print("Please add 'serviceAccountKey.json' to the project directory.")
        print("You can download it from Firebase Console > Project Settings > Service Accounts")
        print()
    
    # Get configuration
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    print(f"Server starting on http://{host}:{port}")
    print(f"Debug mode: {debug}")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        app.run(host=host, port=port, debug=debug)
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

