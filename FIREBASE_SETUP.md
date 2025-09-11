# Firebase Setup Guide for ROOTAI Mobile App

## Overview
This guide will help you set up Firebase Authentication and Firestore for the ROOTAI mobile application, enabling user-specific field coordinate storage.

## Prerequisites
- Firebase project: `esp32---demo-ac37f`
- Firebase service account key: `serviceAccountKey.json` (already configured)

## Step 1: Enable Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `esp32---demo-ac37f`
3. Navigate to **Authentication** > **Sign-in method**
4. Click on **Email/Password** provider
5. Toggle **Enable** to turn on email/password authentication
6. Click **Save**

## Step 2: Enable Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select a location close to your users (e.g., `us-central1`)
5. Click **Done**

## Step 3: Get Web App Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. If you don't have a web app:
   - Click **Add app** and select **Web** (</>) icon
   - Register your app with nickname: `ROOTAI Mobile`
   - Click **Register app**
4. Copy the `firebaseConfig` object from the configuration
5. Replace the placeholder values in `templates/mobile.html`:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "esp32---demo-ac37f.firebaseapp.com",
    projectId: "esp32---demo-ac37f",
    storageBucket: "esp32---demo-ac37f.appspot.com",
    messagingSenderId: "113728002563411730337",
    appId: "your-actual-app-id"
};
```

## Step 4: Configure Firestore Security Rules

1. Go to **Firestore Database** > **Rules**
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own fields
    match /fields/{fieldId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Users can only access their own sensor readings
    match /sensorReadings/{readingId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Users can only access their own alerts
    match /alerts/{alertId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

3. Click **Publish**

## Step 5: Test the Integration

1. Start your Flask application:
   ```bash
   cd software_proto
   python app.py
   ```

2. Open your browser and go to `http://localhost:5000/mobile`

3. Test the authentication flow:
   - Try signing up with a new email/password
   - Try logging in with existing credentials
   - Test the forgot password functionality

4. Test field management:
   - Draw a field on the map
   - Save the field (should be stored in Firestore with your user ID)
   - Logout and login with a different account
   - Verify that you only see your own fields

## Data Structure

### Fields Collection
Each field document in Firestore will have:
```javascript
{
  fieldId: "field_1234567890_abc123",
  userId: "firebase_user_uid",
  fieldName: "North Field",
  boundary: "{\"type\":\"Polygon\",\"coordinates\":[[[...]]]}",
  hardwareLocation: {
    latitude: 18.5204,
    longitude: 73.8567
  },
  createdAt: "2024-01-01T00:00:00Z",
  lastUpdated: "2024-01-01T00:00:00Z"
}
```

### User Authentication
- Users are authenticated via Firebase Auth
- Each user gets a unique UID
- All field operations are scoped to the authenticated user
- JWT tokens are used for API authentication

## Troubleshooting

### Common Issues

1. **"Firebase not initialized" error**
   - Check that you've replaced the placeholder config values
   - Verify the API key and App ID are correct

2. **Authentication errors**
   - Ensure Email/Password provider is enabled
   - Check that the domain is authorized in Firebase Console

3. **Permission denied errors**
   - Verify Firestore security rules are properly configured
   - Check that the user is authenticated before making requests

4. **Field not saving**
   - Check browser console for errors
   - Verify the user is logged in
   - Check Firestore rules allow the operation

### Debug Mode
Enable debug logging by adding this to your browser console:
```javascript
localStorage.setItem('firebase:debug', '*');
```

## Security Considerations

1. **Production Setup**
   - Change Firestore rules to be more restrictive for production
   - Enable additional security features in Firebase Console
   - Use Firebase App Check for additional protection

2. **API Security**
   - All field operations require authentication
   - User can only access their own data
   - JWT tokens are validated on the server side

## Next Steps

1. Set up Firebase Analytics for user behavior tracking
2. Implement Firebase Cloud Messaging for push notifications
3. Add Firebase Storage for image uploads
4. Set up Firebase Functions for server-side processing
5. Implement user roles and permissions

## Support

For issues with this setup:
1. Check Firebase Console for error logs
2. Check browser console for JavaScript errors
3. Verify all configuration values are correct
4. Ensure all Firebase services are properly enabled
