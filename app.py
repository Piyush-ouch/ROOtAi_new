#!/usr/bin/env python3
"""
ROOTAI Precision Agriculture Platform - Flask Backend
"""

import os
import json
import logging
import requests
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load configuration
try:
    from config import Config
    app.config.from_object(Config)
except ImportError:
    logger.warning("Config file not found, using default settings")
    app.config.update({
        'FIREBASE_RTDB_URL': os.environ.get('FIREBASE_RTDB_URL'),
        'FIREBASE_RTDB_ROOT': os.environ.get('FIREBASE_RTDB_ROOT', '/sensorData'),
        'AGMARKNET_API_KEY': os.environ.get('AGMARKNET_API_KEY')
    })

# Initialize Firebase
try:
    import firebase_admin
    from firebase_admin import credentials, firestore, db as rtdb
    
    # Check for service account key
    if os.path.exists('serviceAccountKey.json'):
        cred = credentials.Certificate('serviceAccountKey.json')
        firebase_admin.initialize_app(cred, {
            'databaseURL': app.config.get('FIREBASE_RTDB_URL')
        })
        logger.info("✅ Firebase initialized successfully")
    else:
        logger.warning("⚠️ Firebase credentials file not found!")
        firebase_admin = None
        firestore = None
        rtdb = None
        
except ImportError:
    logger.error("Firebase libraries not installed")
    firebase_admin = None
    firestore = None
    rtdb = None

# Helper functions
def create_geopoint(lat, lng):
    """Create a GeoPoint for Firestore"""
    if firestore:
        return firestore.GeoPoint(lat, lng)
    return {"latitude": lat, "longitude": lng}

def create_buffer_zone(center_lat, center_lng, radius_km=1):
    """Create a circular buffer zone around a point"""
    import math
    
    # Convert km to degrees (approximate)
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * math.cos(math.radians(center_lat)))
    
    # Create a simple square buffer (can be improved to be circular)
    buffer_coords = [
        [center_lat - lat_delta, center_lng - lng_delta],
        [center_lat + lat_delta, center_lng - lng_delta],
        [center_lat + lat_delta, center_lng + lng_delta],
        [center_lat - lat_delta, center_lng + lng_delta],
        [center_lat - lat_delta, center_lng - lng_delta]
    ]
    
    return {
        "type": "Polygon",
        "coordinates": [buffer_coords]
    }

def process_sensor_data(sensor_data):
    """Process sensor data and generate alerts based on rules"""
    alerts = []
    
    # Extract values with fallbacks for different data structures
    env_temp = sensor_data.get('environment', {}).get('temperature', 0)
    env_humidity = sensor_data.get('environment', {}).get('humidity', 0)
    soil_moisture = sensor_data.get('soil', {}).get('moisture', 0)
    soil_temp = sensor_data.get('soil', {}).get('temperature', 0)
    soil_humidity = sensor_data.get('soil', {}).get('humidity', 0)
    
    # Soil moisture dehydration alert
    if soil_moisture < 30:
        alerts.append({
            "type": "dehydration_alert",
            "severity": "critical",
            "message": "Area is Dehydrated! Start irrigation!",
            "recommendation": f"Soil moisture is critically low at {soil_moisture}%. Immediate irrigation required.",
            "icon": "💧",
            "color": "red"
        })
    
    # Soil temperature increase alert (compared to previous readings)
    if soil_temp > 0:  # Only if we have valid soil temp data
        # This would ideally compare with historical data, but for now we'll use a threshold
        if soil_temp > 40:  # High soil temperature threshold
            alerts.append({
                "type": "soil_temp_high",
                "severity": "warning",
                "message": "High soil temperature detected!",
                "recommendation": f"Soil temperature is {soil_temp}°C. Consider shading or irrigation.",
                "icon": "🌡️",
                "color": "orange"
            })
    
    # High humidity pest alert
    if env_humidity > 80 or soil_humidity > 85:
        alerts.append({
            "type": "pest_alert",
            "severity": "warning",
            "message": "Pest Alert! Be Aware!",
            "recommendation": f"High humidity detected (Air: {env_humidity}%, Soil: {soil_humidity}%). Pests may affect your crops. Monitor closely.",
            "icon": "🐛",
            "color": "yellow"
        })
    
    # Temperature alerts
    if env_temp > 35:
        alerts.append({
            "type": "temperature_high",
            "severity": "warning",
            "message": f"High temperature detected: {env_temp}°C",
            "recommendation": "Consider irrigation to cool the soil",
            "icon": "🌡️",
            "color": "orange"
        })
    elif env_temp < 10:
        alerts.append({
            "type": "temperature_low",
            "severity": "warning", 
            "message": f"Low temperature detected: {env_temp}°C",
            "recommendation": "Consider frost protection measures",
            "icon": "❄️",
            "color": "blue"
        })
    
    # Low humidity alert
    if env_humidity < 30:
        alerts.append({
            "type": "humidity_low",
            "severity": "warning",
            "message": f"Low humidity detected: {env_humidity}%",
            "recommendation": "Consider irrigation",
            "icon": "☁️",
            "color": "orange"
        })
    
    # Soil moisture high alert
    if soil_moisture > 80:
        alerts.append({
            "type": "soil_wet",
            "severity": "info",
            "message": f"High soil moisture: {soil_moisture}%",
            "recommendation": "Check drainage system",
            "icon": "💧",
            "color": "blue"
        })
    
    return alerts

def get_mock_market_trends():
    """Fallback mock market trends data"""
    return {
        "source": "mock_data",
        "last_updated": datetime.now().isoformat(),
        "commodities": [
            {
                "name": "Wheat",
                "price": 2100,
                "unit": "quintal",
                "trend": "stable",
                "change_percent": 2.1
            },
            {
                "name": "Rice",
                "price": 3200,
                "unit": "quintal", 
                "trend": "rising",
                "change_percent": 5.3
            },
            {
                "name": "Maize",
                "price": 1800,
                "unit": "quintal",
                "trend": "falling",
                "change_percent": -1.8
            }
        ]
    }

def get_enhanced_mock_market_trends():
    """Enhanced mock market trends with more realistic data"""
    return {
        "source": "enhanced_mock_data",
        "last_updated": datetime.now().isoformat(),
        "commodities": [
            {
                "name": "Wheat",
                "price": 2150,
                "unit": "quintal",
                "trend": "stable",
                "change_percent": 1.2,
                "market": "Delhi",
                "grade": "FAQ"
            },
            {
                "name": "Rice",
                "price": 3250,
                "unit": "quintal",
                "trend": "rising", 
                "change_percent": 4.8,
                "market": "Mumbai",
                "grade": "FAQ"
            },
            {
                "name": "Maize",
                "price": 1850,
                "unit": "quintal",
                "trend": "falling",
                "change_percent": -2.1,
                "market": "Pune",
                "grade": "FAQ"
            },
            {
                "name": "Onion",
                "price": 2800,
                "unit": "quintal",
                "trend": "rising",
                "change_percent": 8.5,
                "market": "Nashik",
                "grade": "FAQ"
            },
            {
                "name": "Tomato",
                "price": 3200,
                "unit": "quintal",
                "trend": "stable",
                "change_percent": 0.5,
                "market": "Bangalore",
                "grade": "FAQ"
            }
        ]
    }

# Routes
@app.route('/')
def index():
    """Serve the mobile application as the primary view"""
    return render_template('mobile.html')

@app.route('/desktop')
def desktop():
    """Serve the desktop application page"""
    return render_template('index.html')

@app.route('/mobile')
def mobile():
    """Serve the mobile application page"""
    return render_template('mobile.html')

@app.route('/api/field/<field_id>')
def get_field(field_id):
    """Get field data by ID"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        db = firestore.client()
        doc_ref = db.collection('fields').document(field_id)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            # Convert GeoPoint to dict for JSON serialization
            if 'hardwareLocation' in data and data['hardwareLocation']:
                data['hardwareLocation'] = {
                    'latitude': data['hardwareLocation'].latitude,
                    'longitude': data['hardwareLocation'].longitude
                }
            return jsonify(data)
        else:
            return jsonify({"error": "Field not found"}), 404
            
    except Exception as e:
        logger.error(f"Error fetching field: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/field/save', methods=['POST'])
def save_field():
    """Save field data"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        # Validate required fields
        required_fields = ['fieldId', 'fieldName', 'boundary']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        db = firestore.client()
        
        # Store boundary as JSON string to avoid Firestore nested entity issues
        field_data = {
            'fieldId': data['fieldId'],
            'userId': data.get('userId', 'default_user'),
            'fieldName': data['fieldName'],
            'boundary': json.dumps(data['boundary']),  # Store as JSON string
            'hardwareLocation': None,
            'createdAt': datetime.now()
        }
        
        doc_ref = db.collection('fields').document(data['fieldId'])
        doc_ref.set(field_data)
        
        logger.info(f"Field saved successfully: {data['fieldId']}")
        return jsonify({"success": True, "fieldId": data['fieldId']})
        
    except Exception as e:
        logger.error(f"Error saving field: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/hardware/location/<field_id>', methods=['POST'])
def update_hardware_location(field_id):
    """Update hardware location for a field"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        data = request.get_json()
        db = firestore.client()
        
        # Create GeoPoint
        location = create_geopoint(data['latitude'], data['longitude'])
        
        # Update field document
        doc_ref = db.collection('fields').document(field_id)
        doc_ref.update({
            'hardwareLocation': location,
            'lastUpdated': datetime.now()
        })
        
        logger.info(f"Hardware location updated for field: {field_id}")
        return jsonify({"success": True})
        
    except Exception as e:
        logger.error(f"Error updating hardware location: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/sensor-data/latest/<field_id>')
def get_latest_sensor_data(field_id):
    """Get latest sensor data for a field"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        db = firestore.client()
        
        # Query latest sensor reading
        readings_ref = db.collection('sensorReadings')
        query = readings_ref.where('fieldId', '==', field_id).order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1)
        docs = query.stream()
        
        for doc in docs:
            data = doc.to_dict()
            return jsonify(data)
            
        return jsonify({"error": "No sensor data found"}), 404
        
    except Exception as e:
        logger.error(f"Error fetching sensor data: {e}")
        return jsonify({"error": "Internal server error"}), 500

def _try_rtdb_roots_and_get_all():
    """Try multiple RTDB roots and return the first non-empty snapshot dict.
    Returns (root_path, snapshot_dict) or (None, None) if none found.
    """
    if not rtdb:
        return None, None
    configured_root = app.config.get('FIREBASE_RTDB_ROOT')
    candidate_roots = []
    # Prefer configured root if provided
    if configured_root:
        candidate_roots.append(configured_root)
    # Common fallbacks used in this project and IoT examples
    for root in ['/sensorData', 'sensorData', '/sensorReadings', 'sensorReadings', '/']:  # keep order
        if root not in candidate_roots:
            candidate_roots.append(root)
    for root in candidate_roots:
        try:
            ref = rtdb.reference(root)
            snap = ref.get()
            if isinstance(snap, dict) and snap:
                return root, snap
        except Exception as ex:
            logger.debug(f"RTDB root check failed for {root}: {ex}")
            continue
    return None, None

def _normalize_reading(key, value):
    """Normalize a RTDB reading record to the expected frontend schema."""
    try:
        return {
            "readingId": key,
            "timestamp": value.get('timestamp') or value.get('time') or datetime.now().isoformat(),
            "environment": value.get('environment', {
                "temperature": value.get('temperature') or value.get('temp'),
                "humidity": value.get('humidity'),
                "pressure": value.get('pressure')
            }) or {},
            "rain": value.get('rain', {
                "precipitation": value.get('precipitation') or value.get('rain') or 0.0,
                "intensity": value.get('rainIntensity') or 'none'
            }) or {},
            "soil": value.get('soil', {
                "moisture": value.get('moisture') or value.get('soilMoisture'),
                "ph": value.get('ph') or value.get('soilPh'),
                "nutrients": value.get('nutrients') or {}
            }) or {}
        }
    except Exception:
        return {"readingId": key}

@app.route('/api/rtdb/sensor-data/latest')
def get_latest_rtdb_sensor_data():
    """Get latest sensor data from Firebase Realtime Database"""
    try:
        if not rtdb:
            logger.warning("Firebase RTDB not initialized, returning mock data")
            # Return mock data when RTDB is not available
            mock_data = {
                "readingId": "mock_001",
                "timestamp": datetime.now().isoformat(),
                "environment": {
                    "temperature": 25.5,
                    "humidity": 65.2,
                    "pressure": 1013.25
                },
                "rain": {
                    "precipitation": 0.0,
                    "intensity": "none"
                },
                "soil": {
                    "moisture": 45.8,
                    "ph": 6.5,
                    "nutrients": {
                        "nitrogen": 85,
                        "phosphorus": 72,
                        "potassium": 68
                    }
                }
            }
            # Generate alerts for mock data
            alerts = process_sensor_data(mock_data)
            mock_data["alerts"] = alerts
            return jsonify(mock_data)

        root, snapshot = _try_rtdb_roots_and_get_all()
        if snapshot:
            # Pick the most recent by timestamp if available, else first item
            items = list(snapshot.items())
            try:
                items.sort(key=lambda kv: kv[1].get('timestamp') or kv[1].get('time') or '', reverse=True)
            except Exception:
                pass
            key, value = items[0]
            logger.info(f"Using RTDB root '{root}' for latest reading id={key}")
            
            # Normalize the reading
            normalized_reading = _normalize_reading(key, value)
            
            # Generate alerts based on the sensor data
            alerts = process_sensor_data(normalized_reading)
            normalized_reading["alerts"] = alerts
            
            return jsonify(normalized_reading)

        # Return mock data if no real data found
        logger.info("No RTDB data found in any known roots, returning mock data")
        mock_data = {
            "readingId": "mock_001",
            "timestamp": datetime.now().isoformat(),
            "environment": {
                "temperature": 25.5,
                "humidity": 65.2,
                "pressure": 1013.25
            },
            "rain": {
                "precipitation": 0.0,
                "intensity": "none"
            },
            "soil": {
                "moisture": 45.8,
                "ph": 6.5,
                "nutrients": {
                    "nitrogen": 85,
                    "phosphorus": 72,
                    "potassium": 68
                }
            }
        }
        # Generate alerts for mock data
        alerts = process_sensor_data(mock_data)
        mock_data["alerts"] = alerts
        return jsonify(mock_data)

    except Exception as e:
        logger.error(f"Error fetching RTDB sensor data: {e}")
        # Return mock data on error
        mock_data = {
            "readingId": "mock_error_001",
            "timestamp": datetime.now().isoformat(),
            "environment": {
                "temperature": 24.0,
                "humidity": 60.0,
                "pressure": 1013.0
            },
            "rain": {
                "precipitation": 0.0,
                "intensity": "none"
            },
            "soil": {
                "moisture": 50.0,
                "ph": 6.0,
                "nutrients": {
                    "nitrogen": 80,
                    "phosphorus": 70,
                    "potassium": 65
                }
            }
        }
        # Generate alerts for mock data
        alerts = process_sensor_data(mock_data)
        mock_data["alerts"] = alerts
        return jsonify(mock_data)

@app.route('/api/rtdb/sensor-data/history')
def get_rtdb_sensor_history():
    """Get sensor data history from Firebase Realtime Database"""
    try:
        if not rtdb:
            logger.warning("Firebase RTDB not initialized, returning mock history")
            # Return mock history data
            mock_readings = []
            for i in range(10):
                mock_readings.append({
                    "readingId": f"mock_history_{i:03d}",
                    "timestamp": (datetime.now() - timedelta(hours=i)).isoformat(),
                    "environment": {
                        "temperature": 25.5 + (i * 0.5),
                        "humidity": 65.2 - (i * 1.2),
                        "pressure": 1013.25 + (i * 0.1)
                    },
                    "rain": {
                        "precipitation": 0.0,
                        "intensity": "none"
                    },
                    "soil": {
                        "moisture": 45.8 + (i * 0.8),
                        "ph": 6.5,
                        "nutrients": {
                            "nitrogen": 85 - (i * 2),
                            "phosphorus": 72 - (i * 1),
                            "potassium": 68 - (i * 1.5)
                        }
                    }
                })
            return jsonify({"readings": mock_readings})

        root, snapshot = _try_rtdb_roots_and_get_all()
        readings = []
        if snapshot:
            for key, value in snapshot.items():
                readings.append(_normalize_reading(key, value))

            # Sort by timestamp ascending for chart time order
            try:
                readings.sort(key=lambda r: r.get('timestamp') or '')
            except Exception:
                pass
            logger.info(f"Using RTDB root '{root}' for history with {len(readings)} readings")

        # If no real data, return mock data
        if not readings:
            logger.info("No RTDB history found in any known roots, returning mock data")
            mock_readings = []
            for i in range(10):
                mock_readings.append({
                    "readingId": f"mock_history_{i:03d}",
                    "timestamp": (datetime.now() - timedelta(hours=i)).isoformat(),
                    "environment": {
                        "temperature": 25.5 + (i * 0.5),
                        "humidity": 65.2 - (i * 1.2),
                        "pressure": 1013.25 + (i * 0.1)
                    },
                    "rain": {
                        "precipitation": 0.0,
                        "intensity": "none"
                    },
                    "soil": {
                        "moisture": 45.8 + (i * 0.8),
                        "ph": 6.5,
                        "nutrients": {
                            "nitrogen": 85 - (i * 2),
                            "phosphorus": 72 - (i * 1),
                            "potassium": 68 - (i * 1.5)
                        }
                    }
                })
            return jsonify({"readings": mock_readings})

        return jsonify({"readings": readings})

    except Exception as e:
        logger.error(f"Error fetching RTDB sensor history: {e}")
        # Return mock data on error
        mock_readings = []
        for i in range(5):
            mock_readings.append({
                "readingId": f"mock_error_{i:03d}",
                "timestamp": (datetime.now() - timedelta(hours=i)).isoformat(),
                "environment": {
                    "temperature": 24.0 + (i * 0.3),
                    "humidity": 60.0 - (i * 1.0),
                    "pressure": 1013.0 + (i * 0.05)
                },
                "rain": {
                    "precipitation": 0.0,
                    "intensity": "none"
                },
                "soil": {
                    "moisture": 50.0 + (i * 0.5),
                    "ph": 6.0,
                    "nutrients": {
                        "nitrogen": 80 - (i * 1),
                        "phosphorus": 70 - (i * 0.5),
                        "potassium": 65 - (i * 1)
                    }
                }
            })
        return jsonify({"readings": mock_readings})

@app.route('/api/alerts/<field_id>')
def get_alerts(field_id):
    """Get active alerts for a field"""
    try:
        if not firestore:
            return jsonify({"error": "Firebase not initialized"}), 500
            
        db = firestore.client()
        
        # Query active alerts
        alerts_ref = db.collection('alerts')
        query = alerts_ref.where('fieldId', '==', field_id).where('active', '==', True).order_by('createdAt', direction=firestore.Query.DESCENDING)
        docs = query.stream()
        
        alerts = []
        for doc in docs:
            data = doc.to_dict()
            alerts.append(data)
            
        return jsonify({"alerts": alerts})
        
    except Exception as e:
        logger.error(f"Error fetching alerts: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/alerts/current')
def get_current_alerts():
    """Get current alerts based on latest sensor data"""
    try:
        # Get latest sensor data
        latest_data_response = get_latest_rtdb_sensor_data()
        latest_data = latest_data_response.get_json()
        
        # Extract alerts from the latest data
        alerts = latest_data.get('alerts', [])
        
        # Filter only critical and warning alerts for display
        active_alerts = [alert for alert in alerts if alert.get('severity') in ['critical', 'warning']]
        
        return jsonify({
            "alerts": active_alerts,
            "timestamp": latest_data.get('timestamp'),
            "total_alerts": len(active_alerts)
        })
        
    except Exception as e:
        logger.error(f"Error fetching current alerts: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/diagnose', methods=['POST'])
def diagnose_plant():
    """AI-powered plant disease diagnosis"""
    try:
        # This is a mock implementation
        # In a real application, you would use a trained ML model
        
        data = request.get_json()
        image_data = data.get('image')  # Base64 encoded image
        
        # Mock diagnosis result
        diagnosis = {
            "disease": "Leaf Blight",
            "confidence": 0.85,
            "severity": "moderate",
            "recommendation": "Apply fungicide treatment and improve air circulation",
            "treatment": {
                "chemical": "Copper-based fungicide",
                "organic": "Neem oil spray",
                "prevention": "Regular monitoring and proper spacing"
            }
        }
        
        return jsonify(diagnosis)
        
    except Exception as e:
        logger.error(f"Error in diagnosis: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/market-trends')
def get_market_trends():
    """Get market trends from Agmarknet API"""
    try:
        api_key = app.config.get('AGMARKNET_API_KEY')
        
        if not api_key:
            logger.warning("No Agmarknet API key found, using mock data")
            return jsonify(get_mock_market_trends())
        
        # Agmarknet dataset (Daily prices)
        base_url = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24"
        
        # Optional filters from query params
        commodity = request.args.get('commodity')
        state = request.args.get('state')
        market = request.args.get('market')

        params = {'api-key': api_key, 'format': 'json', 'limit': 50}
        # Normalize inputs to improve matching
        def norm(x):
            try:
                return ' '.join(w.capitalize() for w in x.strip().split())
            except Exception:
                return x
        if state:
            params['filters[state]'] = norm(state)
        if commodity:
            params['filters[commodity]'] = norm(commodity)
        if market:
            params['filters[market]'] = norm(market)
        
        def query_and_transform(query_params):
            logger.info(f"Querying Agmarknet with params: {query_params}")
            resp = requests.get(base_url, params=query_params, timeout=12)
            resp.raise_for_status()
            js = resp.json()
            recs = js.get('records') or []
            items = []
            for record in recs[:50]:
                try:
                    price_val = record.get('Modal_Price') or record.get('modal_price') or record.get('modalprice')
                    if price_val is None:
                        continue
                    price_num = float(price_val)
                    if price_num <= 0:
                        continue
                    items.append({
                        "name": record.get('Commodity') or record.get('commodity') or 'Unknown',
                        "price": price_num,
                        "unit": "quintal",
                        "trend": "stable",
                        "change_percent": 0.0,
                        "market": record.get('Market') or record.get('market') or 'Unknown',
                        "state": record.get('State') or record.get('state') or 'Unknown',
                        "district": record.get('District') or record.get('district') or 'Unknown',
                        "grade": record.get('Grade') or record.get('grade') or 'FAQ'
                    })
                except Exception:
                    continue
            return items

        try:
            # Try with all filters first, then progressively relax to avoid empty results
            attempts = []
            attempts.append(params.copy())
            if 'filters[commodity]' in params:
                p2 = params.copy(); p2.pop('filters[commodity]')
                attempts.append(p2)
            if 'filters[market]' in params:
                p3 = params.copy(); p3.pop('filters[market]')
                attempts.append(p3)
            # State only
            p4 = {k: v for k, v in params.items() if k in ('api-key','format','limit','filters[state]')}
            attempts.append(p4)
            # No filters
            attempts.append({'api-key': api_key, 'format': 'json', 'limit': 50})

            # Capture original user intent strings for fuzzy filtering
            user_commodity = norm(commodity) if commodity else None
            user_market = norm(market) if market else None

            for qp in attempts:
                items = query_and_transform(qp)
                if not items:
                    continue

                # If strict filters failed earlier, apply fuzzy contains matching on results
                filtered = items
                if user_commodity:
                    lc = user_commodity.lower()
                    filtered = [it for it in filtered if (it.get('name') or '').lower().find(lc) != -1]
                if user_market:
                    lm = user_market.lower()
                    filtered = [it for it in filtered if (
                        (it.get('market') or '').lower().find(lm) != -1) or (
                        (it.get('district') or '').lower().find(lm) != -1)
                    ]

                # Prefer filtered results if filters were provided; else return all
                result_items = filtered if (user_commodity or user_market) else items
                if result_items:
                    return jsonify({
                        "source": "agmarknet_api",
                        "last_updated": datetime.now().isoformat(),
                        "used_filters": {k: v for k, v in qp.items() if k.startswith('filters[')},
                        "commodities": result_items
                    })

            logger.warning("Agmarknet returned no items even after relaxed filters; using mock data")
            return jsonify(get_enhanced_mock_market_trends())
        except requests.exceptions.RequestException as e:
            logger.error(f"Agmarknet API request failed: {e}")
            return jsonify(get_enhanced_mock_market_trends())
            
    except Exception as e:
        logger.error(f"Error fetching market trends: {e}")
        return jsonify(get_enhanced_mock_market_trends())

# Weather endpoint using Open-Meteo (no API key required)
@app.route('/api/weather')
def get_weather():
    """Get current weather for given latitude and longitude using Open-Meteo."""
    try:
        lat = request.args.get('lat')
        lng = request.args.get('lng') or request.args.get('lon')
        if not lat or not lng:
            return jsonify({"error": "lat and lng are required"}), 400

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lng,
            "current_weather": True,
            "hourly": "relative_humidity_2m,temperature_2m,precipitation"
        }
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        current = data.get("current_weather", {})
        result = {
            "temperature": current.get("temperature"),
            "windspeed": current.get("windspeed"),
            "winddirection": current.get("winddirection"),
            "weathercode": current.get("weathercode"),
            "time": current.get("time"),
            "units": {
                "temperature": data.get("hourly_units", {}).get("temperature_2m", "°C")
            }
        }
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching weather: {e}")
        return jsonify({"error": "Failed to fetch weather"}), 500

# Cloud Function simulation
def process_new_sensor_reading(reading_data):
    """Simulate Cloud Function for processing new sensor readings"""
    try:
        if not firestore:
            return
            
        db = firestore.client()
        field_id = reading_data.get('fieldId')
        
        if not field_id:
            return
            
        # Get field data
        field_doc = db.collection('fields').document(field_id).get()
        if not field_doc.exists:
            return
            
        field_data = field_doc.to_dict()
        hardware_location = field_data.get('hardwareLocation')
        
        if not hardware_location:
            return
            
        # Process sensor data and generate alerts
        alerts = process_sensor_data(reading_data)
        
        # Save alerts to Firestore
        for alert in alerts:
            alert_doc = {
                'fieldId': field_id,
                'type': alert['type'],
                'severity': alert['severity'],
                'message': alert['message'],
                'recommendation': alert['recommendation'],
                'active': True,
                'createdAt': datetime.now()
            }
            db.collection('alerts').add(alert_doc)
        
        # Create affected zone if critical alert
        critical_alerts = [a for a in alerts if a['severity'] == 'critical']
        if critical_alerts and hardware_location:
            affected_zone = create_buffer_zone(
                hardware_location.latitude,
                hardware_location.longitude,
                radius_km=2
            )
            
            # Update field with affected zone
            db.collection('fields').document(field_id).update({
                'affectedZone': json.dumps(affected_zone),
                'lastAlertAt': datetime.now()
            })
            
    except Exception as e:
        logger.error(f"Error processing sensor reading: {e}")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
