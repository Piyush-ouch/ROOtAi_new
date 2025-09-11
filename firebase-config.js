// Firebase Configuration
// Replace these values with your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE", // Get this from Firebase Console > Project Settings > General > Web apps
    authDomain: "esp32---demo-ac37f.firebaseapp.com",
    projectId: "esp32---demo-ac37f",
    storageBucket: "esp32---demo-ac37f.appspot.com",
    messagingSenderId: "113728002563411730337",
    appId: "YOUR_APP_ID_HERE" // Get this from Firebase Console > Project Settings > General > Web apps
};

// Instructions to get your Firebase configuration:
// 1. Go to Firebase Console (https://console.firebase.google.com/)
// 2. Select your project: "esp32---demo-ac37f"
// 3. Click on the gear icon (Settings) > Project settings
// 4. Scroll down to "Your apps" section
// 5. If you don't have a web app, click "Add app" and select Web (</>) icon
// 6. Register your app with a nickname (e.g., "ROOTAI Mobile")
// 7. Copy the config object and replace the values above
// 8. Make sure to enable Authentication in Firebase Console:
//    - Go to Authentication > Sign-in method
//    - Enable "Email/Password" provider
// 9. Make sure Firestore is enabled:
//    - Go to Firestore Database > Create database
//    - Start in test mode for development

export default firebaseConfig;



