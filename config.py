"""
Configuration file for ROOTAI Precision Agriculture Platform
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Base configuration class"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    FLASK_ENV = os.environ.get('FLASK_ENV') or 'development'
    FLASK_DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    # Firebase configuration
    FIREBASE_CREDENTIALS_PATH = os.environ.get('FIREBASE_CREDENTIALS_PATH') or 'serviceAccountKey.json'
    FIREBASE_RTDB_URL = os.environ.get('FIREBASE_RTDB_URL')  # e.g. https://your-project-id.firebaseio.com
    FIREBASE_RTDB_ROOT = os.environ.get('FIREBASE_RTDB_ROOT', 'sensorReadings')
    
    # API configuration
    
    AGMARKNET_API_KEY = os.environ.get('AGMARKNET_API_KEY')
    
    # Default settings
    DEFAULT_LOCATION = {"lat": 28.6139, "lng": 77.2090}  # New Delhi
    BUFFER_RADIUS_METERS = 10

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False

class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
