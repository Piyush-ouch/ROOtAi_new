"""
Test script to verify ROOTAI setup
"""

import sys
import os

def test_imports():
    """Test if all required modules can be imported"""
    try:
        import flask
        print("✓ Flask imported successfully")
    except ImportError as e:
        print(f"✗ Flask import failed: {e}")
        return False
    
    try:
        import firebase_admin
        print("✓ Firebase Admin imported successfully")
    except ImportError as e:
        print(f"✗ Firebase Admin import failed: {e}")
        return False
    
    try:
        from google.cloud import firestore
        print("✓ Firestore imported successfully")
    except ImportError as e:
        print(f"✗ Firestore import failed: {e}")
        return False
    
    return True

def test_config():
    """Test configuration loading"""
    try:
        from config import config
        print("✓ Configuration loaded successfully")
        return True
    except Exception as e:
        print(f"✗ Configuration loading failed: {e}")
        return False

def test_firebase_credentials():
    """Test if Firebase credentials file exists"""
    if os.path.exists('serviceAccountKey.json'):
        print("✓ Firebase credentials file found")
        return True
    else:
        print("⚠ Firebase credentials file not found - you'll need to add serviceAccountKey.json")
        return False

def main():
    """Run all tests"""
    print("ROOTAI Setup Test")
    print("=" * 50)
    
    tests = [
        ("Import Tests", test_imports),
        ("Configuration Tests", test_config),
        ("Firebase Credentials", test_firebase_credentials)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        if test_func():
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed! Setup is complete.")
    else:
        print("⚠ Some tests failed. Please check the issues above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

