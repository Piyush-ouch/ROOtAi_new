# ROOTAI Precision Agriculture Platform

A comprehensive web application for AI-powered precision agriculture with real-time sensor monitoring, field management, and intelligent alerts.

## Features

- **Real-time Sensor Monitoring**: Temperature, humidity, soil moisture, and pH level tracking
- **Interactive Field Mapping**: Draw field boundaries using Leaflet.js with GPS integration
- **DOOT Device Integration**: Connect and locate IoT devices in the field
- **AI-Powered Disease Detection**: Upload leaf images for automated diagnosis
- **Smart Alerts**: Rule-based pest forecasting and crop health notifications
- **Market Trends**: Real-time commodity price monitoring
- **Responsive Design**: Mobile-first interface built with Tailwind CSS

## Tech Stack

### Backend
- **Flask**: Python web framework
- **Firebase Firestore**: NoSQL database for real-time data
- **firebase-admin**: Python SDK for Firebase integration

### Frontend
- **HTML5**: Semantic markup
- **Tailwind CSS**: Utility-first CSS framework
- **JavaScript (ES6+)**: Modern JavaScript features
- **Leaflet.js**: Interactive maps with drawing capabilities
- **Chart.js**: Data visualization and charts

## Installation

### Prerequisites
- Python 3.8 or higher
- Node.js (for frontend dependencies, if needed)
- Firebase project with Firestore enabled

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd software_proto
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Firebase Setup**
   - Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
   - Enable Firestore Database
   - Generate a service account key:
     - Go to Project Settings > Service Accounts
     - Click "Generate new private key"
     - Save the JSON file as `serviceAccountKey.json` in the project root
   - Update Firestore security rules to allow read/write access

4. **Environment Configuration**
   - Copy `config.py` and update Firebase credentials path if needed
   - Set environment variables if required

5. **Run the application**
   ```bash
   python app.py
   ```

6. **Access the application**
   - Open your browser and navigate to `http://localhost:5000`

## Database Schema

### Fields Collection
```json
{
  "fieldId": "string (document ID)",
  "userId": "string",
  "fieldName": "string",
  "boundary": "GeoJSON object",
  "hardwareLocation": "GeoPoint",
  "createdAt": "Timestamp"
}
```

### Sensor Readings Collection
```json
{
  "fieldId": "string",
  "rawData": "JSON string",
  "timestamp": "Timestamp",
  "processed": "boolean"
}
```

### Alerts Collection
```json
{
  "fieldId": "string",
  "type": "string",
  "severity": "string",
  "message": "string",
  "recommendations": "array",
  "affectedZone": "GeoJSON polygon",
  "status": "string",
  "createdAt": "Timestamp"
}
```

## API Endpoints

### Field Management
- `GET /api/field/<field_id>` - Get field data including boundary and hardware location
- `POST /api/field/save` - Save new field with GeoJSON boundary
- `POST /api/hardware/location/<field_id>` - Update hardware device location

### Sensor Data
- `GET /api/sensor-data/latest/<field_id>` - Get latest sensor readings
- `GET /api/alerts/<field_id>` - Get active alerts for a field

### AI Services
- `POST /api/diagnose` - Upload leaf image for AI diagnosis
- `GET /api/market-trends` - Get current market trends and prices

## Usage

### 1. Field Management
- Click "Draw Field Boundary" to start mapping your field
- Use the map tools to draw polygon boundaries
- Click "Save Field" to store the field data

### 2. Device Connection
- After creating a field, click "Connect with DOOT"
- Allow location access for high-accuracy GPS positioning
- The device location will be marked on the map

### 3. Disease Detection
- Click "Upload Leaf Image" to analyze plant health
- Upload a clear image of affected leaves
- View AI diagnosis and treatment recommendations

### 4. Monitoring
- View real-time sensor data in the dashboard
- Monitor alerts and recommendations
- Track market trends and commodity prices

## Development

### Project Structure
```
software_proto/
├── app.py                 # Flask application
├── config.py             # Configuration settings
├── requirements.txt      # Python dependencies
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   └── js/
│       └── main.js       # Frontend JavaScript
└── README.md
```

### Adding New Features
1. Backend: Add new routes in `app.py`
2. Frontend: Extend JavaScript functions in `static/js/main.js`
3. Database: Update Firestore collections as needed
4. UI: Modify HTML template in `templates/index.html`

## Deployment

### Railway Deployment (Recommended)

1. **Connect Repository**
   - Go to [Railway.app](https://railway.app)
   - Connect your GitHub repository
   - Select the `AgroDoot-first-prototype` repository

2. **Set Environment Variables**
   ```
   FIREBASE_RTDB_URL=your_firebase_rtdb_url
   FLASK_DEBUG=False
   ```

3. **Add Firebase Credentials**
   - Upload `serviceAccountKey.json` as a secret file in Railway dashboard
   - Or set Firebase credentials as environment variables

4. **Deploy**
   - Railway will automatically deploy on git push
   - The app will be available at the provided Railway URL

### Production Considerations
- Set up proper Firebase security rules
- Use environment variables for sensitive configuration
- Implement proper error handling and logging
- Set up HTTPS for secure communication
- Configure CORS for production domains

### Other Cloud Platforms
- Deploy Flask app to services like Heroku, AWS, or Google Cloud
- Set up Firebase project for production
- Configure domain and SSL certificates
- Set up monitoring and logging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Roadmap

- [ ] Real-time data streaming with WebSockets
- [ ] Advanced AI models for disease detection
- [ ] Mobile app development
- [ ] Integration with more IoT devices
- [ ] Advanced analytics and reporting
- [ ] Multi-language support

