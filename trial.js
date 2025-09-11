/**
 * ROOTAI Mobile Interface - JavaScript
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";
// Global variables
let currentScreen = 'splash';
let sensorData = null; // This will be updated in real-time
let map = null;
let drawControl = null;
let drawnLayer = null;
let currentFieldId = null;
let marketTrends = null;
let analyticsChart = null;
let metricDetailChart = null;
let growthChart = null;
let isAuthenticated = false;
let currentUser = null;
let authToken = null;

const firebaseConfig = {
    apiKey: "AIzaSyAMF-H37hakWbtwGfy8-wvTWV_5RtYoUmY",
    authDomain: "esp32---demo-ac37f.firebaseapp.com",
    databaseURL: "https://esp32---demo-ac37f-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "esp32---demo-ac37f",
    storageBucket: "esp32---demo-ac37f.appspot.com",
    messagingSenderId: "113728002563411730337",
    appId: "1:465358325818:web:11322d74bef27fc9d38d03"
  };

  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);


// Initialize the mobile app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Initialize the mobile application
 */
async function initializeApp() {
    console.log('Initializing ROOTAI Mobile App...');
    
    // Initialize map first (needed for home screen)
    initializeMap();
    
    // Check authentication status
    checkAuthenticationStatus();
    
    // Set up authentication event listeners
    setupAuthEventListeners();
    
    // If authenticated, initialize the main app
    if (isAuthenticated) {
        initializeMainApp();
    } else {
        // Show splash screen for 2 seconds, then login
        setTimeout(() => {
            showScreen('login');
        }, 2000);
    }
    
    console.log('Mobile app initialized successfully');
}

/**
 * Initialize the main application (after authentication)
 */
async function initializeMainApp() {
    // Load initial data
    await loadInitialData();
    
    // Set up event listeners
    setupEventListeners();
}

/**
 * Initialize the map
 */
function initializeMap() {
    const mapContainer = document.getElementById('field-map');
    if (!mapContainer) {
        console.log('Map container not found, will initialize later');
        return;
    }
    
    // Check if map is already initialized
    if (map) {
        console.log('Map already initialized');
        return;
    }
    
    console.log('Initializing map...');
    
    // Check if Leaflet is available
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet not loaded!');
        return;
    }
    
    // Check if container is visible
    const containerRect = mapContainer.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
        console.log('Map container not visible, will retry...');
        setTimeout(() => initializeMap(), 500);
        return;
    }
    
    try {
        // Clear any existing content
        mapContainer.innerHTML = '';
        
        // Initialize Leaflet map
        map = L.map('field-map', {
            preferCanvas: true,
            zoomControl: true,
            attributionControl: true
        }).setView([18.5204, 73.8567], 15); // default center
        
        console.log('✅ Leaflet map created');
    } catch (error) {
        console.error('❌ Error creating map:', error);
        showMapError();
        return;
    }
    
    // Add tile layer
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 20
    }).addTo(map);

    // Reliable satellite layer (Esri)
    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 20
    });

    // Optional Google satellite (may be restricted by ToS/rate limits)
    const googleSatellite = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        subdomains: ['0','1','2','3'],
        maxZoom: 20,
        attribution: 'Imagery © Google'
    });

    // Layer control
    L.control.layers({
        'Street (OSM)': osm,
        'Satellite (Esri)': esriSatellite,
        'Satellite (Google)': googleSatellite
    }, {}, { position: 'topright', collapsed: true }).addTo(map)
    
    // Add draw controls (polygon only)
    drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3 }
            },
            marker: false,
            circle: false,
            circlemarker: false,
            polyline: false,
            rectangle: false
        },
        edit: false
    });
    map.addControl(drawControl);

    // Listen for created polygon
    map.on(L.Draw.Event.CREATED, function (e) {
        if (drawnLayer) {
            map.removeLayer(drawnLayer);
        }
        drawnLayer = e.layer;
        drawnLayer.addTo(map);
        document.getElementById('save-field-btn').disabled = false;
    });

    // Try to locate the user
    locateUserOnMap();
    
    // Hide loading indicator
    const loadingIndicator = document.getElementById('map-loading');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    
    console.log('✅ Map initialized successfully');
}

/**
 * Show map error state
 */
function showMapError() {
    const loadingIndicator = document.getElementById('map-loading');
    const errorIndicator = document.getElementById('map-error');
    
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (errorIndicator) errorIndicator.style.display = 'flex';
}

/**
 * Show map loading state
 */
function showMapLoading() {
    const loadingIndicator = document.getElementById('map-loading');
    const errorIndicator = document.getElementById('map-error');
    
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (errorIndicator) errorIndicator.style.display = 'none';
}

/** Center map on user's current location (with graceful fallback) */
function locateUserOnMap() {
    if (!map || !navigator.geolocation) return;
    const options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 };
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 16);
            const marker = L.marker([lat, lng]).addTo(map);
            marker.bindPopup('You are here').openPopup();
            if (pos.coords.accuracy) {
                const acc = pos.coords.accuracy;
                L.circle([lat, lng], { radius: acc, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1 }).addTo(map);
            }
        },
        () => {
            // If denied or failed, keep default center silently
        },
        options
    );
}

/**
 * Load initial data
 */
async function loadInitialData() {
    try {
        // Load sensor data
        await loadSensorData();
        
        // Load market trends
        await loadMarketTrends();
        
        // Load field list
        await loadFieldList();
        
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

/**
 * Load sensor data
 */
async function loadSensorData() {
    try {
        const response = await fetch('/api/rtdb/sensor-data/latest');
        if (response.ok) {
            sensorData = await response.json();
            updateSensorDisplay();
        }
    } catch (error) {
        console.error('Error loading sensor data:', error);
        // Use mock data
        sensorData = {
            readingId: 'mock_001',
            timestamp: new Date().toISOString(),
            environment: {
                temperature: 32,
                humidity: 65,
                pressure: 1013
            },
            rain: {
                precipitation: 0,
                intensity: 'none'
            },
            soil: {
                moisture: 45,
                ph: 6.5,
                nutrients: {
                    nitrogen: 85,
                    phosphorus: 72,
                    potassium: 68
                }
            }
        };
        updateSensorDisplay();
    }
}

/**
 * Update sensor display
 */
function updateSensorDisplay() {
    if (!sensorData) return;
    
    const sensorReadings = document.getElementById('sensor-readings');
    if (!sensorReadings) return;
    
    const readings = [
        {
            name: 'Field Temperature',
            value: `${sensorData.environment.temperature}°C`,
            icon: '🌡️',
            metric: 'environment.temperature',
            trend: -2.07,
            color: 'red'
        },
        {



            
            name: 'Field Humidity',
            value: `${sensorData.environment.humidity}%`,
            icon: '☁️',
            metric: 'environment.humidity',
            trend: 0.07,
            color: 'blue'
        },
        {
            name: 'Soil Temperature',
            value: `${sensorData.soil.moisture}°C`,
            icon: '🌱',
            metric: 'soil.temperature',
            trend: 1.87,
            color: 'green'
        },
        {
            name: 'Soil Moisture',
            value: `${sensorData.soil.moisture}%`,
            icon: '💧',
            metric: 'soil.moisture',
            trend: 0.07,
            color: 'blue'
        },
        {
            name: 'Soil Humidity',
            value: `${sensorData.environment.humidity}%`,
            icon: '☁️',
            metric: 'environment.humidity',
            trend: -2.07,
            color: 'blue'
        },
        {
            name: 'Rain Count',
            value: `${sensorData.rain.precipitation}mm`,
            icon: '🌧️', 
            metric: 'rain.precipitation',
            trend: 0.07,
            color: 'blue'
        }
    ];
    
    sensorReadings.innerHTML = readings.map(reading => `
        <div class="sensor-card" data-metric="${reading.metric}">
            <div class="sensor-header">
                <div class="flex items-center gap-2">
                    <span class="text-2xl">${reading.icon}</span>
                    <span class="text-sm font-medium text-gray-700">${reading.name}</span>
                </div>
                <div class="sensor-value">${reading.value}</div>
            </div>
            <div class="trend-indicator ${reading.trend > 0 ? 'trend-up' : 'trend-down'}">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>${Math.abs(reading.trend)}%</span>
            </div>
            <div class="w-full h-2 bg-gray-200 rounded mt-2">
                <div class="h-2 bg-${reading.color}-500 rounded" style="width: ${Math.min(Math.abs(reading.trend) * 10, 100)}%"></div>
            </div>
        </div>
    `).join('');

    // Click to open metric detail
    document.querySelectorAll('#sensor-readings .sensor-card').forEach(card => {
        card.addEventListener('click', () => {
            const metric = card.getAttribute('data-metric');
            const title = card.querySelector('.text-sm.font-medium')?.textContent || 'Metric';
            openMetricDetail(metric, title);
        });
    });
}

/**
 * Load market trends
 */
async function loadMarketTrends() {
    try {
        const url = new URL('/api/market-trends', window.location.origin);
        const commodity = document.getElementById('mt-commodity')?.value;
        const state = document.getElementById('mt-state')?.value;
        const market = document.getElementById('mt-market')?.value;
        if (commodity) url.searchParams.set('commodity', commodity);
        if (state) url.searchParams.set('state', state);
        if (market) url.searchParams.set('market', market);
        const response = await fetch(url.toString());
        if (response.ok) {
            marketTrends = await response.json();
            updateMarketTrendsDisplay();
        }
    } catch (error) {
        console.error('Error loading market trends:', error);
    }
}

/**
 * Update market trends display
 */
function updateMarketTrendsDisplay() {
    if (!marketTrends || !marketTrends.commodities) return;
    
    const marketContent = document.getElementById('market-trends-content');
    if (!marketContent) return;
    
    const sourceBadge = `<div class="text-xs text-gray-500 mb-2">Source: ${marketTrends.source || 'unknown'}</div>`;
    
    marketContent.innerHTML = sourceBadge + marketTrends.commodities.map(commodity => `
        <div class="sensor-card">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${commodity.name}</h3>
                    <p class="text-sm text-gray-600">${commodity.market || 'Market'}</p>
                </div>
                <div class="text-right">
                    <div class="text-xl font-bold text-gray-800">₹${commodity.price}</div>
                    <div class="text-sm text-gray-600">per ${commodity.unit}</div>
                </div>
            </div>
            <div class="flex justify-between items-center mt-2">
                <span class="text-sm text-gray-600">${commodity.grade || 'FAQ'}</span>
                <div class="trend-indicator ${commodity.change_percent > 0 ? 'trend-up' : 'trend-down'}">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <span>${Math.abs(commodity.change_percent)}%</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Load field list
 */
async function loadFieldList() {
    try {
        const fieldSelect = document.getElementById('field-select');
        if (!fieldSelect) return;
        
        // Load user's fields from API
        console.log('Loading user fields...');
        const response = await makeAuthenticatedRequest('/api/fields');
        console.log('Fields API response:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            const fields = data.fields || [];
            console.log('Loaded fields:', fields);
            
            fieldSelect.innerHTML = '<option value="">Choose a field...</option>' +
                fields.map(field => `<option value="${field.fieldId}">${field.fieldName}</option>`).join('');
        } else {
            // Fallback to mock fields if API fails
            const mockFields = [
                { fieldId: 'field_001', fieldName: 'North Field' },
                { fieldId: 'field_002', fieldName: 'South Field' },
                { fieldId: 'field_003', fieldName: 'East Field' }
            ];
            
            fieldSelect.innerHTML = '<option value="">Choose a field...</option>' +
                mockFields.map(field => `<option value="${field.fieldId}">${field.fieldName}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading field list:', error);
        // Fallback to mock fields
        const fieldSelect = document.getElementById('field-select');
        if (fieldSelect) {
            const mockFields = [
                { fieldId: 'field_001', fieldName: 'North Field' },
                { fieldId: 'field_002', fieldName: 'South Field' },
                { fieldId: 'field_003', fieldName: 'East Field' }
            ];
            
            fieldSelect.innerHTML = '<option value="">Choose a field...</option>' +
                mockFields.map(field => `<option value="${field.fieldId}">${field.fieldName}</option>`).join('');
        }
    }
}

/**
 * Check authentication status
 */
function checkAuthenticationStatus() {
    // Listen for authentication state changes
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            isAuthenticated = true;
            currentScreen = 'home';
            
            // Get the ID token for API calls
            user.getIdToken().then((token) => {
                authToken = token;
            });
            
            // Initialize main app if not already done
            if (currentScreen === 'home') {
                initializeMainApp();
            }
        } else {
            currentUser = null;
            isAuthenticated = false;
            authToken = null;
            currentScreen = 'splash';
        }
    });
}

/**
 * Set up authentication event listeners
 */
function setupAuthEventListeners() {
    // Login/Signup tab switching
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (loginTab && signupTab) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('text-green-600', 'border-b-2', 'border-green-600');
            loginTab.classList.remove('text-gray-500');
            signupTab.classList.add('text-gray-500');
            signupTab.classList.remove('text-green-600', 'border-b-2', 'border-green-600');
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
        });
        
        signupTab.addEventListener('click', () => {
            signupTab.classList.add('text-green-600', 'border-b-2', 'border-green-600');
            signupTab.classList.remove('text-gray-500');
            loginTab.classList.add('text-gray-500');
            loginTab.classList.remove('text-green-600', 'border-b-2', 'border-green-600');
            signupForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        });
    }
    
    // Signup link
    const signupLink = document.getElementById('signup-link');
    if (signupLink) {
        signupLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (signupTab) signupTab.click();
        });
    }
    
    // Login form submission
    const loginContinueBtn = document.getElementById('login-continue-btn');
    if (loginContinueBtn) {
        loginContinueBtn.addEventListener('click', handleLogin);
    }
    
    // Signup form submission
    const signupContinueBtn = document.getElementById('signup-continue-btn');
    if (signupContinueBtn) {
        signupContinueBtn.addEventListener('click', handleSignup);
    }
    
    // Forgot password link
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('forgot-password');
        });
    }
    
    // Forgot password form submission
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', handleForgotPassword);
    }
    
    // Set password form submission
    const setPasswordContinueBtn = document.getElementById('set-password-continue-btn');
    if (setPasswordContinueBtn) {
        setPasswordContinueBtn.addEventListener('click', handleSetPassword);
    }
    
    // Success continue button
    const successContinueBtn = document.getElementById('success-continue-btn');
    if (successContinueBtn) {
        successContinueBtn.addEventListener('click', () => {
            showScreen('login');
        });
    }
    
    // Back buttons
    const forgotBackBtn = document.getElementById('forgot-back-btn');
    if (forgotBackBtn) {
        forgotBackBtn.addEventListener('click', () => {
            showScreen('login');
        });
    }
    
    const setPasswordBackBtn = document.getElementById('set-password-back-btn');
    if (setPasswordBackBtn) {
        setPasswordBackBtn.addEventListener('click', () => {
            showScreen('forgot-password');
        });
    }
    
    // Password visibility toggles
    setupPasswordVisibilityToggles();
}

/**
 * Set up password visibility toggles
 */
function setupPasswordVisibilityToggles() {
    const passwordToggles = document.querySelectorAll('button[type="button"]');
    passwordToggles.forEach(toggle => {
        const input = toggle.parentElement.querySelector('input[type="password"]');
        if (input) {
            toggle.addEventListener('click', () => {
                if (input.type === 'password') {
                    input.type = 'text';
                    toggle.innerHTML = `
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/>
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                        </svg>
                    `;
                } else {
                    input.type = 'password';
                    toggle.innerHTML = `
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                        </svg>
                    `;
                }
            });
        }
    });
}

/**
 * Handle login
 */
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        // Sign in with Firebase
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Get the ID token
        authToken = await user.getIdToken();
        
        // Update UI
        showScreen('home');
        
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
        }
        
        alert(errorMessage);
    }
}

/**
 * Handle signup
 */
async function handleSignup() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    if (!name || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    try {
        // Create user with Firebase
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update user profile with display name
        await user.updateProfile({
            displayName: name
        });
        
        // Get the ID token
        authToken = await user.getIdToken();
        
        // Update UI
        showScreen('home');
        
    } catch (error) {
        console.error('Signup error:', error);
        let errorMessage = 'Signup failed. Please try again.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'An account with this email already exists.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled. Please contact support.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
            case 'auth/invalid-api-key':
                errorMessage = 'Firebase configuration error. Please contact support.';
                break;
            case 'auth/app-not-authorized':
                errorMessage = 'App not authorized. Please check Firebase configuration.';
                break;
            default:
                errorMessage = `Signup failed: ${error.message}`;
        }
        
        console.error('Signup error details:', error.code, error.message);
        alert(errorMessage);
    }
}

/**
 * Handle forgot password
 */
async function handleForgotPassword() {
    const email = document.getElementById('forgot-email').value;
    
    if (!email) {
        alert('Please enter your email');
        return;
    }
    
    try {
        // Send password reset email
        await auth.sendPasswordResetEmail(email);
        alert('Password reset email sent! Check your inbox.');
        showScreen('login');
        
    } catch (error) {
        console.error('Forgot password error:', error);
        let errorMessage = 'Failed to send reset email. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
        }
        
        alert(errorMessage);
    }
}

/**
 * Handle set password
 */
async function handleSetPassword() {
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (!password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Show success screen
        showScreen('success');
        
    } catch (error) {
        console.error('Set password error:', error);
        alert('Failed to update password. Please try again.');
    }
}

/**
 * Logout function
 */
async function logout() {
    try {
        // Sign out from Firebase
        await auth.signOut();
        
        // Reset app state
        currentUser = null;
        authToken = null;
        isAuthenticated = false;
        currentScreen = 'login';
        
        // Hide bottom navigation
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'none';
        }
        
        // Show login screen
        showScreen('login');
        
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Connect DOOT button
    const connectBtn = document.getElementById('connect-doot-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', connectWithDoot);
    }
    
    // Field selection
    const fieldSelect = document.getElementById('field-select');
    if (fieldSelect) {
        fieldSelect.addEventListener('change', function() {
            currentFieldId = this.value;
            if (currentFieldId) {
                loadFieldData(currentFieldId);
            }
        });
    }
    
    // Image upload handlers
    const healthUpload = document.getElementById('health-image-upload');
    if (healthUpload) {
        healthUpload.addEventListener('change', handleHealthImageUpload);
    }
    
    const growthUpload = document.getElementById('growth-image-upload');
    if (growthUpload) {
        growthUpload.addEventListener('change', handleGrowthImageUpload);
    }

    // Draw field button
    const drawBtn = document.getElementById('draw-field-btn');
    if (drawBtn) {
        drawBtn.addEventListener('click', function() {
            // Ensure map is initialized before drawing
            if (!map) {
                console.log('Map not initialized, initializing now...');
                initializeMap();
                // Wait a bit for map to initialize
                setTimeout(() => {
                    if (map && drawControl) {
                        new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();
                    } else {
                        alert('Map is not ready. Please try again.');
                    }
                }, 500);
            } else {
                new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();
            }
        });
    }

    // Save field button
    const saveBtn = document.getElementById('save-field-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveDrawnField);
    }

    // Locate button
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', locateUserOnMap);
    }

    const applyBtn = document.getElementById('mt-apply');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => loadMarketTrends());
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Retry map button
    const retryMapBtn = document.getElementById('retry-map-btn');
    if (retryMapBtn) {
        retryMapBtn.addEventListener('click', function() {
            console.log('Retrying map initialization...');
            showMapLoading();
            // Reset map variable
            map = null;
            // Try to initialize again
            setTimeout(() => {
                initializeMap();
            }, 500);
        });
    }
}

/**
 * Show specific screen
 */
function showScreen(screenName) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Show selected screen
    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
        targetScreen.classList.add('active');
        currentScreen = screenName;
        
        // Show/hide bottom navigation based on authentication and screen
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            if (isAuthenticated && ['home', 'crop-health', 'profile'].includes(screenName)) {
                bottomNav.style.display = 'flex';
                updateNavigation(screenName);
            } else {
                bottomNav.style.display = 'none';
            }
        }
        
        // Load screen-specific data
        loadScreenData(screenName);
        
        // Initialize map if showing home screen and map not initialized
        if (screenName === 'home' && !map) {
            // Show loading indicator
            showMapLoading();
            
            // Wait for the screen to be fully visible
            setTimeout(() => {
                console.log('Attempting to initialize map for home screen...');
                initializeMap();
                
                // Set timeout to show error if map doesn't load
                setTimeout(() => {
                    if (!map) {
                        console.log('Map initialization timeout');
                        showMapError();
                    }
                }, 5000); // 5 second timeout
            }, 300); // Longer delay to ensure screen is visible
        }
    }
}

/**
 * Update navigation
 */
function updateNavigation(activeScreen) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Map screen names to nav items
    const navMap = {
        'home': 0,
        'crop-health': 1,
        'profile': 2
    };
    
    const navIndex = navMap[activeScreen];
    if (navIndex !== undefined && navItems[navIndex]) {
        navItems[navIndex].classList.add('active');
    }
}

/**
 * Load screen-specific data
 */
function loadScreenData(screenName) {
    switch (screenName) {
        case 'home':
            // Ensure map is initialized for home screen
            if (!map) {
                setTimeout(() => {
                    initializeMap();
                }, 200);
            }
            break;
        case 'field-analytics':
            initializeAnalyticsChart();
            startSensorAutoRefresh();
            break;
        case 'growth-tracker':
            initializeGrowthChart();
            break;
        case 'market-trends':
            updateMarketTrendsDisplay();
            break;
        case 'profile':
            updateProfileData();
            break;
    }
}

/**
 * Update profile data
 */
function updateProfileData() {
    if (currentUser) {
        const userName = currentUser.displayName || 'User Name';
        const userEmail = currentUser.email || 'user@example.com';
        
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        
        if (profileName) profileName.textContent = userName;
        if (profileEmail) profileEmail.textContent = userEmail;
    }
}

/**
 * Make authenticated API call
 */
async function makeAuthenticatedRequest(url, options = {}) {
    if (!authToken) {
        throw new Error('No authentication token available');
    }
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    const response = await fetch(url, mergedOptions);
    
    if (response.status === 401) {
        // Token expired, sign out user
        await auth.signOut();
        throw new Error('Authentication expired');
    }
    
    return response;
}

/**
 * Initialize analytics chart
 */
function initializeAnalyticsChart() {
    const ctx = document.getElementById('analytics-chart');
    if (!ctx) return;
    
    if (analyticsChart) {
        analyticsChart.destroy();
    }

    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Sensor', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.35, fill: true, pointRadius: 0 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });

    // Load history for selected metric
    const metricSelect = document.getElementById('metric-select');
    if (metricSelect) {
        metricSelect.onchange = () => refreshSensorHistory();
    }
    refreshSensorHistory();
}

/**
 * Initialize growth chart
 */
function initializeGrowthChart() {
    const ctx = document.getElementById('growth-chart');
    if (!ctx) return;
    
    if (growthChart) {
        growthChart.destroy();
    }
    
    growthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
            datasets: [{
                label: 'Growth Progress',
                data: [20, 35, 50, 65, 85, 90, 95],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 25
                    }
                }
            }
        }
    });
}

/** Save drawn field to backend */
async function saveDrawnField() {
    if (!drawnLayer) {
        alert('Please draw a field first');
        return;
    }
    const latlngs = drawnLayer.getLatLngs()[0] || drawnLayer.getLatLngs();
    const coordinates = latlngs.map(ll => [ll.lng, ll.lat]);
    if (coordinates.length && (coordinates[0][0] !== coordinates[coordinates.length-1][0] || coordinates[0][1] !== coordinates[coordinates.length-1][1])) {
        coordinates.push(coordinates[0]);
    }
    const geojson = { type: 'Polygon', coordinates: [coordinates] };

    const fieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
    const payload = { fieldId, fieldName: `Field ${new Date().toLocaleDateString()}` , boundary: geojson };

    try {
        console.log('Saving field with payload:', payload);
        const res = await makeAuthenticatedRequest('/api/field/save', { 
            method: 'POST', 
            body: JSON.stringify(payload) 
        });
        console.log('Save field response:', res.status);
        
        if (res.ok) {
            const data = await res.json();
            currentFieldId = data.fieldId;
            console.log('Field saved successfully:', data);
            alert('Field saved successfully');
            document.getElementById('save-field-btn').disabled = true;
            
            // Reload field list
            await loadFieldList();
        } else {
            const err = await res.json();
            console.error('Save field error:', err);
            alert('Failed to save field: ' + (err.error || 'Unknown error'));
        }
    } catch (e) {
        console.error('Error saving field:', e);
        alert('Network error saving field: ' + e.message);
    }
}

/** Fetch RTDB history and update chart */
async function refreshSensorHistory() {
    try {
        const res = await fetch('/api/rtdb/sensor-data/history');
        if (!res.ok) return;
        const data = await res.json();
        const readings = data.readings || [];
        const metricPath = document.getElementById('metric-select')?.value || 'environment.humidity';
        const values = readings.map(r => getMetricValue(r, metricPath)).filter(v => typeof v === 'number');
        const labels = readings.map(r => new Date(r.timestamp || Date.now()).toLocaleTimeString());
        analyticsChart.data.labels = labels;
        analyticsChart.data.datasets[0].label = metricPath;
        analyticsChart.data.datasets[0].data = values;
        analyticsChart.update();

        // Update trend bars for all visible metric cards
        updateAllTrendBarsFromHistory(readings);
    } catch (e) {
        console.error('Error loading history', e);
    }
}

function getMetricValue(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

let autoRefreshHandle = null;
function startSensorAutoRefresh() {
    if (autoRefreshHandle) clearInterval(autoRefreshHandle);
    autoRefreshHandle = setInterval(refreshSensorHistory, 60 * 1000);
}

/**
 * Connect with DOOT device
 */
async function connectWithDoot() {
    const btn = document.getElementById('connect-doot-btn');
    const status = document.getElementById('connection-status');
    
    if (!btn || !status) return;
    
    try {
        btn.textContent = 'Connecting...';
        btn.disabled = true;
        
        // Simulate connection process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update UI
        btn.textContent = 'Connected';
        btn.style.background = '#10b981';
        status.textContent = 'Connected';
        status.className = 'connection-status connected';
        
    } catch (error) {
        console.error('Error connecting with DOOT:', error);
        btn.textContent = 'Connect with DOOT';
        btn.disabled = false;
        status.textContent = 'Connection Failed';
        status.className = 'connection-status disconnected';
    }
}

/**
 * Load field data
 */
async function loadFieldData(fieldId) {
    try {
        const response = await makeAuthenticatedRequest(`/api/field/${fieldId}`);
        if (response.ok) {
            const fieldData = await response.json();
            console.log('Field data loaded:', fieldData);
            // Update map with field boundary
            updateMapWithField(fieldData);
        } else {
            console.error('Failed to load field data');
        }
    } catch (error) {
        console.error('Error loading field data:', error);
    }
}

/**
 * Update map with field data
 */
function updateMapWithField(fieldData) {
    if (!map || !fieldData.boundary) return;
    
    // Clear existing layers
    map.eachLayer(layer => {
        if (layer instanceof L.Polygon) {
            map.removeLayer(layer);
        }
    });
    
    // Parse boundary data
    let boundary;
    try {
        boundary = typeof fieldData.boundary === 'string' 
            ? JSON.parse(fieldData.boundary) 
            : fieldData.boundary;
    } catch (error) {
        console.error('Error parsing boundary data:', error);
        return;
    }
    
    // Add field boundary to map
    if (boundary.type === 'Polygon' && boundary.coordinates) {
        const coordinates = boundary.coordinates[0].map(coord => [coord[1], coord[0]]);
        const fieldPolygon = L.polygon(coordinates, {
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.3
        }).addTo(map);
        
        map.fitBounds(fieldPolygon.getBounds());
    }
}

/**
 * Handle health image upload
 */
async function handleHealthImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        // Convert to base64
        const base64 = await fileToBase64(file);
        
        // Send to diagnosis API
        const response = await fetch('/api/diagnose', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: base64
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            displayDiagnosisResult(result);
        }
    } catch (error) {
        console.error('Error processing health image:', error);
        alert('Error processing image. Please try again.');
    }
}

/**
 * Handle growth image upload
 */
async function handleGrowthImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        // Convert to base64
        const base64 = await fileToBase64(file);
        
        // For now, just show a success message
        alert('Growth analysis image uploaded successfully!');
        
    } catch (error) {
        console.error('Error processing growth image:', error);
        alert('Error processing image. Please try again.');
    }
}

/**
 * Display diagnosis result
 */
function displayDiagnosisResult(result) {
    const resultsDiv = document.getElementById('diagnosis-results');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = `
        <div class="flex items-center gap-2 mb-3">
            <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <h3 class="text-lg font-semibold text-gray-800">Results</h3>
        </div>
        <div class="mb-4">
            <img src="data:image/jpeg;base64,${result.image || ''}" alt="Diagnosed leaf" class="w-full h-48 object-cover rounded-lg">
        </div>
        <div class="space-y-3">
            <div>
                <h4 class="font-semibold text-gray-800">Possible Diseases:</h4>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-gray-700">${result.disease}</span>
                    <span class="confidence-badge">${Math.round(result.confidence * 100)}% Confidence</span>
                </div>
            </div>
            <div>
                <h4 class="font-semibold text-gray-800">Possible Cause:</h4>
                <p class="text-sm text-gray-600 mt-1">${result.cause || 'This disease is caused by a fungus, primarily Septoria chrysanthemi.'}</p>
            </div>
            <div>
                <h4 class="font-semibold text-gray-800">Recommended Cure:</h4>
                <p class="text-sm text-gray-600 mt-1">${result.recommendation || 'Fungicides: Chlorothalonil: A broad-spectrum fungicide effective against many leaf spots.'}</p>
            </div>
        </div>
    `;
    
    resultsDiv.style.display = 'block';
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// Export functions for global access
window.showScreen = showScreen;
window.connectWithDoot = connectWithDoot;

// Compute deltas and update corresponding sensor card's trend and bar
function updateTrendBarsFromHistory(values, metricPath) {
    if (!values || values.length < 2) return;
    const current = values[values.length - 1];
    const previous = values[values.length - 2];
    const delta = Number((current - previous).toFixed(2));
    const percent = previous !== 0 ? ((delta / Math.abs(previous)) * 100) : 0;

    const card = Array.from(document.querySelectorAll('#sensor-readings .sensor-card'))
        .find(el => el.getAttribute('data-metric') === metricPath);
    if (!card) return;

    const indicator = card.querySelector('.trend-indicator');
    indicator.classList.toggle('trend-up', delta > 0);
    indicator.classList.toggle('trend-down', delta <= 0);
    const span = indicator.querySelector('span:last-child');
    if (span) span.textContent = `${Math.abs(percent).toFixed(2)}%`;

    const bar = card.querySelector('.w-full .h-2');
    if (bar) bar.style.width = `${Math.min(Math.abs(percent), 100)}%`;

    // Add subtitle message for aria (not shown here)
    card.setAttribute('data-delta', delta);
}

function updateAllTrendBarsFromHistory(readings) {
    const metrics = ['environment.temperature', 'environment.humidity', 'soil.moisture', 'rain.precipitation'];
    metrics.forEach(metric => {
        const values = readings
            .map(r => getMetricValue(r, metric))
            .filter(v => typeof v === 'number');
        updateTrendBarsFromHistory(values, metric);
    });
}

async function openMetricDetail(metricPath, title) {
    showScreen('metric-detail');
    document.getElementById('metric-detail-title').textContent = title;
    document.getElementById('metric-detail-subtitle').textContent = `${title} History`;

    // Build chart
    const ctx = document.getElementById('metric-detail-chart');
    if (metricDetailChart) metricDetailChart.destroy();

    try {
        const res = await fetch('/api/rtdb/sensor-data/history');
        const data = await res.json();
        const readings = data.readings || [];
        const values = readings.map(r => getMetricValue(r, metricPath)).filter(v => typeof v === 'number');
        const labels = readings.map(r => new Date(r.timestamp || Date.now()).toLocaleTimeString());

        metricDetailChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: title, data: values, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.35, fill: true, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
        });

        const msg = document.getElementById('metric-detail-msg');
        if (values.length >= 2) {
            const current = values[values.length - 1];
            const previous = values[values.length - 2];
            const delta = Number((current - previous).toFixed(2));
            if (delta > 0) {
                msg.textContent = `${title} is slightly increased by ${delta}`;
            } else if (delta < 0) {
                msg.textContent = `${title} seems decreasing by ${Math.abs(delta)}`;
            } else {
                msg.textContent = `${title} is unchanged compared to previous reading.`;
            }
        } else {
            msg.textContent = 'Not enough data to compute change.';
        }
    } catch (e) {
        console.error('Metric detail error', e);
    }
}
