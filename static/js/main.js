/**
 * ROOTAI Precision Agriculture Platform - Main JavaScript
 * Handles all frontend functionality including mapping, location services, and API calls
 */

// Global variables
let map;
let drawnItems;
let currentFieldId = null;
let userLocation = null;
let hardwareLocation = null;
let sensorChart = null;
let sensorHistoryChart = null;
let fieldBoundary = null;
let autoRefreshInterval = null;
let gridLayer = null;
let gridVisible = false;
let gridCells = [];

// Math helper (fix for missing Math.radians used below)
if (!Math.radians) {
    Math.radians = function(degrees) { return degrees * Math.PI / 180; };
}

// API Base URL
const API_BASE = '';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
    loadMarketTrends();
    loadRealtimeSensorData();
    loadSensorHistory();
    updateSensorDisplay();
    startAutoRefresh();
});

/**
 * Initialize the Leaflet map with user's location
 */
async function initializeMap() {
    // Initialize map with default location (New Delhi)
    map = L.map('map').setView([28.6139, 77.2090], 13);
    
    // Base layers
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
    }, {}, { position: 'topright', collapsed: true }).addTo(map);
    
    // Initialize drawn items layer
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    // Initialize draw control
    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                drawError: {
                    color: '#e1e100',
                    message: '<strong>Error:</strong> shape edges cannot cross!'
                },
                shapeOptions: {
                    color: '#10b981',
                    fillColor: '#10b981',
                    fillOpacity: 0.2
                }
            },
            polyline: false,
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);
    
    // Get user's current location
    await getUserLocation();
    
    // Load existing field data if available
    await loadFieldData();
    
    // Set up map event listeners
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);
        fieldBoundary = layer.toGeoJSON();
        console.log('Field boundary drawn:', fieldBoundary);
    });
    
    map.on(L.Draw.Event.EDITED, function(event) {
        const layers = event.layers;
        layers.eachLayer(function(layer) {
            fieldBoundary = layer.toGeoJSON();
            console.log('Field boundary updated:', fieldBoundary);
            
            // Regenerate grid when field is edited
            if (fieldBoundary && gridVisible) {
                showGrid();
            }
        });
    });
}

/**
 * Get user's current location using Geolocation API
 */
async function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.warn('Geolocation is not supported by this browser');
            resolve();
            return;
        }
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Center map on user location
                map.setView([userLocation.lat, userLocation.lng], 15);
                
                // Add user location marker
                L.marker([userLocation.lat, userLocation.lng])
                    .addTo(map)
                    .bindPopup('Your Location')
                    .openPopup();
                
                console.log('User location obtained:', userLocation);
                resolve(userLocation);
            },
            function(error) {
                console.warn('Error getting user location:', error.message);
                // Keep default location
                resolve();
            },
            options
        );
    });
}

/**
 * Get high-accuracy location for DOOT device connection
 */
async function getHighAccuracyLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
        }
        
        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0 // Force fresh location
        };
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                console.log('High accuracy location obtained:', location);
                resolve(location);
            },
            function(error) {
                console.error('Error getting high accuracy location:', error.message);
                reject(error);
            },
            options
        );
    });
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Connect with DOOT button
    document.getElementById('connectDootBtn').addEventListener('click', connectWithDoot);
    
    // Upload image button
    document.getElementById('uploadImageBtn').addEventListener('click', () => {
        document.getElementById('imageUpload').click();
    });
    
    // Image upload handler
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    
    // Field management buttons
    document.getElementById('drawFieldBtn').addEventListener('click', startDrawingField);
    document.getElementById('saveFieldBtn').addEventListener('click', saveField);
    document.getElementById('toggleGridBtn').addEventListener('click', toggleGrid);
    document.getElementById('clearMapBtn').addEventListener('click', clearMap);
}

/**
 * Connect with DOOT device
 */
async function connectWithDoot() {
    if (!currentFieldId) {
        alert('Please create and save a field first');
        return;
    }
    
    try {
        // Show loading state
        const btn = document.getElementById('connectDootBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Connecting...';
        btn.disabled = true;
        
        // Get high accuracy location
        const location = await getHighAccuracyLocation();
        
        // Send location to backend
        const response = await fetch(`/api/hardware/location/${currentFieldId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                latitude: location.lat,
                longitude: location.lng
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            hardwareLocation = location;
            
            // Add hardware location marker to map
            addHardwareMarker(location);
            
            // Update device status
            updateDeviceStatus('Connected', 'Device successfully connected');
            
            alert('DOOT device connected successfully!');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to connect device');
        }
        
    } catch (error) {
        console.error('Error connecting with DOOT:', error);
        alert('Failed to connect with DOOT device: ' + error.message);
    } finally {
        // Reset button state
        const btn = document.getElementById('connectDootBtn');
        btn.textContent = 'Connect with DOOT';
        btn.disabled = false;
    }
}

/**
 * Add hardware location marker to map
 */
function addHardwareMarker(location) {
    // Remove existing hardware marker
    map.eachLayer(layer => {
        if (layer.options && layer.options.className === 'hardware-marker') {
            map.removeLayer(layer);
        }
    });
    
    // Add new hardware marker
    const marker = L.marker([location.lat, location.lng], {
        className: 'hardware-marker'
    }).addTo(map);
    
    marker.bindPopup(`
        <div class="text-center">
            <h3 class="font-semibold text-blue-600">DOOT Device</h3>
            <p class="text-sm text-gray-600">Connected</p>
            <p class="text-xs text-gray-500">${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</p>
        </div>
    `);
    
    hardwareLocation = location;
}

/**
 * Handle image upload for AI diagnosis
 */
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        // Show loading state
        const btn = document.getElementById('uploadImageBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Processing...';
        btn.disabled = true;
        
        // Create form data
        const formData = new FormData();
        formData.append('image', file);
        
        // Send to backend
        const response = await fetch('/api/diagnose', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const diagnosis = await response.json();
            showDiagnosisModal(diagnosis);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to process image');
        }
        
    } catch (error) {
        console.error('Error processing image:', error);
        alert('Failed to process image: ' + error.message);
    } finally {
        // Reset button state
        const btn = document.getElementById('uploadImageBtn');
        btn.textContent = 'Upload Leaf Image';
        btn.disabled = false;
        
        // Clear file input
        event.target.value = '';
    }
}

/**
 * Show diagnosis results in a modal
 */
function showDiagnosisModal(diagnosis) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-gray-900">AI Diagnosis Results</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <div class="space-y-4">
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 class="font-medium text-red-800">${diagnosis.disease_detected}</h4>
                    <p class="text-sm text-red-600">Confidence: ${(diagnosis.confidence * 100).toFixed(1)}%</p>
                    <p class="text-sm text-red-600">Severity: ${diagnosis.severity}</p>
                </div>
                
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Description</h4>
                    <p class="text-sm text-gray-600">${diagnosis.description}</p>
                </div>
                
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Recommendations</h4>
                    <ul class="text-sm text-gray-600 space-y-1">
                        ${diagnosis.recommendations.map(rec => `<li>• ${rec}</li>`).join('')}
                    </ul>
                </div>
                
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Treatment Plan</h4>
                    <div class="space-y-2 text-sm">
                        <div><strong>Immediate:</strong> ${diagnosis.treatment_plan.immediate}</div>
                        <div><strong>Short-term:</strong> ${diagnosis.treatment_plan.short_term}</div>
                        <div><strong>Long-term:</strong> ${diagnosis.treatment_plan.long_term}</div>
                    </div>
                </div>
            </div>
            
            <div class="mt-6 flex justify-end">
                <button onclick="this.closest('.fixed').remove()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Start drawing field boundary
 */
function startDrawingField() {
    // Enable polygon drawing
    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: {
                    color: '#10b981',
                    fillColor: '#10b981',
                    fillOpacity: 0.2
                }
            },
            polyline: false,
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false
        }
    });
    
    // Remove existing draw control
    map.eachLayer(layer => {
        if (layer instanceof L.Control.Draw) {
            map.removeControl(layer);
        }
    });
    
    map.addControl(drawControl);
    alert('Click on the map to start drawing your field boundary. Double-click to finish.');
}

/**
 * Save field to backend
 */
async function saveField() {
    if (!fieldBoundary) {
        alert('Please draw a field boundary first');
        return;
    }
    
    try {
        const fieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fieldData = {
            fieldId: fieldId,
            userId: 'user123', // In a real app, this would come from authentication
            fieldName: `Field ${Date.now()}`,
            boundary: fieldBoundary
        };
        
        const response = await fetch('/api/field/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(fieldData)
        });
        
        if (response.ok) {
            const result = await response.json();
            currentFieldId = result.fieldId;
            try { localStorage.setItem('currentFieldId', currentFieldId); } catch (_) {}
            
            // Update field info
            updateFieldInfo(fieldData.fieldName, fieldBoundary);
            
            // Automatically show grid after saving field
            showGrid();
            
            alert(`Field saved successfully! Grid with 1×1 meter blocks is now visible. Field ID: ${fieldId}`);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save field');
        }
        
    } catch (error) {
        console.error('Error saving field:', error);
        alert('Failed to save field: ' + error.message);
    }
}

/**
 * Clear map
 */
function clearMap() {
    drawnItems.clearLayers();
    fieldBoundary = null;
    currentFieldId = null;
    hardwareLocation = null;
    try { localStorage.removeItem('currentFieldId'); } catch (_) {}
    
    // Remove grid layer
    if (gridLayer) {
        map.removeLayer(gridLayer);
        gridLayer = null;
        gridVisible = false;
        updateGridButton();
    }
    
    // Remove hardware marker
    map.eachLayer(layer => {
        if (layer.options && layer.options.className === 'hardware-marker') {
            map.removeLayer(layer);
        }
    });
    
    // Reset UI
    updateFieldInfo('No field selected', null);
    updateGridInfo(null);
    updateDeviceStatus('No device connected', '');
}

/**
 * Toggle grid overlay
 */
function toggleGrid() {
    if (!fieldBoundary) {
        alert('Please draw a field boundary first');
        return;
    }
    
    if (gridVisible) {
        hideGrid();
    } else {
        showGrid();
    }
}

/**
 * Show grid overlay
 */
function showGrid() {
    if (!fieldBoundary) return;
    
    // Remove existing grid layer
    if (gridLayer) {
        map.removeLayer(gridLayer);
    }
    
    // Generate grid
    gridLayer = generateFieldGrid(fieldBoundary);
    map.addLayer(gridLayer);
    gridVisible = true;
    
    // Update button and info
    updateGridButton();
    updateGridInfo(fieldBoundary);
}

/**
 * Hide grid overlay
 */
function hideGrid() {
    if (gridLayer) {
        map.removeLayer(gridLayer);
        gridLayer = null;
        gridVisible = false;
        updateGridButton();
        updateGridInfo(null);
    }
}

/**
 * Update grid toggle button text
 */
function updateGridButton() {
    const btn = document.getElementById('toggleGridBtn');
    if (gridVisible) {
        btn.textContent = 'Hide Grid (1m²)';
        btn.className = 'bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm transition-colors';
    } else {
        btn.textContent = 'Show Grid (1m²)';
        btn.className = 'bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors';
    }
}

/**
 * Generate grid overlay for field boundary
 */
function generateFieldGrid(geojson) {
    if (!geojson || !geojson.coordinates || !geojson.coordinates[0]) return null;
    
    const coords = geojson.coordinates[0];
    const bounds = getBoundsFromCoordinates(coords);
    
    // Calculate grid size in meters (1 meter per grid cell)
    const gridSizeMeters = 1;
    
    // Convert meters to degrees (approximate)
    const latDegreePerMeter = 1 / 111320; // 1 degree latitude ≈ 111,320 meters
    const lngDegreePerMeter = 1 / (111320 * Math.cos(Math.radians(bounds.center.lat)));
    
    const gridSizeLat = gridSizeMeters * latDegreePerMeter;
    const gridSizeLng = gridSizeMeters * lngDegreePerMeter;
    
    // Create grid layer
    const gridGroup = L.layerGroup();
    gridCells = [];
    
    // Calculate number of grid cells
    const latCells = Math.ceil((bounds.max.lat - bounds.min.lat) / gridSizeLat);
    const lngCells = Math.ceil((bounds.max.lng - bounds.min.lng) / gridSizeLng);
    
    // Generate grid cells
    for (let i = 0; i < latCells; i++) {
        for (let j = 0; j < lngCells; j++) {
            const cellLat1 = bounds.min.lat + (i * gridSizeLat);
            const cellLng1 = bounds.min.lng + (j * gridSizeLng);
            const cellLat2 = bounds.min.lat + ((i + 1) * gridSizeLat);
            const cellLng2 = bounds.min.lng + ((j + 1) * gridSizeLng);
            
            // Create cell polygon (Leaflet expects [lat, lng])
            const cellCoordsLeaflet = [
                [cellLat1, cellLng1],
                [cellLat2, cellLng1],
                [cellLat2, cellLng2],
                [cellLat1, cellLng2],
                [cellLat1, cellLng1]
            ];
            
            const cellPolygon = L.polygon(cellCoordsLeaflet, {
                color: '#94a3b8', // slate-400 outline
                weight: 0.6,
                opacity: 0.7,
                fillColor: '#000000',
                fillOpacity: 0.0, // default: no fill for cleanliness
                className: 'grid-cell'
            });
            
            // Check if cell is within field boundary
            // Build GeoJSON coords as [lng, lat]
            const cellCoordsLngLat = [
                [cellLng1, cellLat1],
                [cellLng1, cellLat2],
                [cellLng2, cellLat2],
                [cellLng2, cellLat1],
                [cellLng1, cellLat1]
            ];
            const cellGeoJSON = {
                type: 'Polygon',
                coordinates: [cellCoordsLngLat]
            };
            
            if (isPolygonWithinField(cellGeoJSON, geojson)) {
                // Add cell number as popup and register for dynamic styling
                const cellNumber = i * lngCells + j + 1;
                cellPolygon.bindPopup(
                    `<div class="text-center">
                        <h3 class="font-semibold text-indigo-600">Grid Cell ${cellNumber}</h3>
                        <p class="text-sm text-gray-600">Size: 1m × 1m</p>
                        <p class="text-xs text-gray-500">Area: 1 m²</p>
                    </div>`
                );
                cellPolygon.on('click', () => highlightSelectedCell(cellPolygon));
                gridCells.push({ number: cellNumber, layer: cellPolygon });
                gridGroup.addLayer(cellPolygon);
            }
        }
    }
    
    return gridGroup;
}

// Lightweight selection highlight (local visual feedback)
function highlightSelectedCell(layer) {
    try {
        gridCells.forEach(c => c.layer.setStyle({ weight: 0.6 }));
        layer.setStyle({ weight: 2 });
    } catch (_) {}
}

// Public hook: update grid cell styles from external sensor status
// mapping: { [cellNumber]: { status: 'ok'|'warn'|'critical', value?: number } }
function updateGridStylesFromMapping(mapping) {
    if (!mapping || !Array.isArray(gridCells)) return;
    gridCells.forEach(({ number, layer }) => {
        const m = mapping[number];
        if (!m) {
            // default subtle outline
            layer.setStyle({ fillOpacity: 0.0, color: '#94a3b8' });
            return;
        }
        // style by status
        if (m.status === 'critical') {
            layer.setStyle({ fillColor: '#ef4444', fillOpacity: 0.35, color: '#b91c1c', weight: 1.2 });
        } else if (m.status === 'warn') {
            layer.setStyle({ fillColor: '#f59e0b', fillOpacity: 0.25, color: '#b45309', weight: 1.0 });
        } else {
            layer.setStyle({ fillColor: '#22c55e', fillOpacity: 0.15, color: '#15803d', weight: 0.8 });
        }
    });
}

// Placeholder: call this with RTDB per-cell arrays when available
function ingestGridDataFromRTDB(snapshot) {
    // Expected shape example:
    // { cells: { '1': { moisture: 28 }, '2': { moisture: 55 }, ... } }
    try {
        if (!snapshot || !snapshot.cells) return;
        const mapping = {};
        Object.keys(snapshot.cells).forEach(key => {
            const cell = snapshot.cells[key] || {};
            const moisture = Number(cell.moisture);
            let status = 'ok';
            if (!isNaN(moisture)) {
                if (moisture < 30) status = 'critical';
                else if (moisture < 40) status = 'warn';
            }
            mapping[Number(key)] = { status, value: moisture };
        });
        updateGridStylesFromMapping(mapping);
    } catch (e) {
        console.error('Error ingesting grid RTDB data:', e);
    }
}

/**
 * Get bounds from coordinates array
 */
function getBoundsFromCoordinates(coords) {
    // coords are GeoJSON [lng, lat]
    let minLat = coords[0][1];
    let maxLat = coords[0][1];
    let minLng = coords[0][0];
    let maxLng = coords[0][0];
    
    coords.forEach(coord => {
        const [lng, lat] = coord;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    });
    
    return {
        min: { lat: minLat, lng: minLng },
        max: { lat: maxLat, lng: maxLng },
        center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }
    };
}

/**
 * Check if a polygon is within the field boundary (simplified point-in-polygon)
 */
function isPolygonWithinField(cellGeoJSON, fieldGeoJSON) {
    // Simple check: if any corner of the cell is within the field
    const cellCoords = cellGeoJSON.coordinates[0]; // [lng, lat]
    const fieldCoords = fieldGeoJSON.coordinates[0]; // [lng, lat]
    
    for (let coord of cellCoords) {
        if (isPointInPolygon(coord, fieldCoords)) {
            return true;
        }
    }
    
    // Also check if field center is in cell
    const fieldCenter = getPolygonCenter(fieldGeoJSON);
    const cellCenter = getPolygonCenter(cellGeoJSON);
    
    return isPointInPolygon(fieldCenter, cellCoords);
}

/**
 * Check if point is inside polygon using ray casting algorithm
 */
function isPointInPolygon(point, polygon) {
    const [x, y] = point; // x=lng, y=lat
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

/**
 * Get center point of polygon
 */
function getPolygonCenter(geojson) {
    const coords = geojson.coordinates[0];
    let sumLat = 0;
    let sumLng = 0;
    
    coords.forEach(coord => {
        sumLat += coord[0];
        sumLng += coord[1];
    });
    
    return [sumLat / coords.length, sumLng / coords.length];
}

/**
 * Update grid information display
 */
function updateGridInfo(fieldBoundary) {
    const container = document.getElementById('gridInfo');
    
    if (fieldBoundary && gridVisible) {
        const bounds = getBoundsFromCoordinates(fieldBoundary.coordinates[0]);
        const area = calculatePolygonArea(fieldBoundary);
        const totalCells = Math.floor(area); // 1 cell per square meter
        
        container.innerHTML = `
            <p><strong>Grid Size:</strong> 1m × 1m</p>
            <p><strong>Total Cells:</strong> ${totalCells}</p>
            <p><strong>Grid Status:</strong> Active</p>
        `;
    } else {
        container.innerHTML = '<p>No grid available</p>';
    }
}

/**
 * Load field data from backend
 */
async function loadFieldData() {
    console.log('Loading field data...');
    try {
        const savedId = localStorage.getItem('currentFieldId');
        if (!savedId) return;
        const resp = await fetch(`/api/field/${savedId}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data.boundary) return;
        let boundary;
        try {
            boundary = typeof data.boundary === 'string' ? JSON.parse(data.boundary) : data.boundary;
        } catch (_) { return; }
        if (!boundary || !boundary.coordinates) return;
        currentFieldId = savedId;
        fieldBoundary = boundary;

        // Draw the saved field on map
        renderFieldPolygon(boundary);
        // Show grid automatically
        showGrid();
        updateFieldInfo(data.fieldName || 'Saved Field', boundary);
    } catch (e) {
        console.error('Error loading saved field:', e);
    }
}

function renderFieldPolygon(boundary) {
    try {
        // Convert GeoJSON [lng,lat] to Leaflet [lat,lng]
        const latlngs = (boundary.coordinates[0] || []).map(([lng, lat]) => [lat, lng]);
        const polygon = L.polygon(latlngs, {
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.2
        });
        drawnItems.clearLayers();
        drawnItems.addLayer(polygon);
        map.fitBounds(polygon.getBounds());
    } catch (_) {}
}

/**
 * Load sensor data and update display
 */
async function loadSensorData() {
    if (!currentFieldId) return;
    
    try {
        const response = await fetch(`/api/sensor-data/latest/${currentFieldId}`);
        if (response.ok) {
            const data = await response.json();
            updateSensorDisplay(data.processedData);
        }
    } catch (error) {
        console.error('Error loading sensor data:', error);
    }
}

/**
 * Update sensor display values
 */
function updateSensorDisplay(data = null) {
    if (data) {
        document.getElementById('temperatureValue').textContent = `${data.temperature || 0}°C`;
        document.getElementById('humidityValue').textContent = `${data.humidity || 0}%`;
        document.getElementById('soilMoistureValue').textContent = `${data.soil_moisture || 0}%`;
        document.getElementById('phValue').textContent = data.ph || 0;
    } else {
        // Mock data for demonstration
        document.getElementById('temperatureValue').textContent = '25°C';
        document.getElementById('humidityValue').textContent = '65%';
        document.getElementById('soilMoistureValue').textContent = '45%';
        document.getElementById('phValue').textContent = '6.8';
    }
}

/**
 * Load alerts for current field
 */
async function loadAlerts() {
    if (!currentFieldId) return;
    
    try {
        const response = await fetch(`/api/alerts/${currentFieldId}`);
        if (response.ok) {
            const alerts = await response.json();
            displayAlerts(alerts);
        }
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

/**
 * Display alerts in the UI
 */
function displayAlerts(alerts) {
    const container = document.getElementById('alertsContainer');
    
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p>No active alerts</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="border border-red-200 rounded-lg p-4 bg-red-50">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <h3 class="font-medium text-red-800">${alert.type.replace(/_/g, ' ').toUpperCase()}</h3>
                    <p class="text-sm text-red-600 mt-1">${alert.message}</p>
                    <div class="mt-2">
                        <h4 class="text-sm font-medium text-red-700">Recommendations:</h4>
                        <ul class="text-sm text-red-600 mt-1 space-y-1">
                            ${alert.recommendations.map(rec => `<li>• ${rec}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                <span class="px-2 py-1 text-xs font-medium text-red-800 bg-red-200 rounded-full">
                    ${alert.severity}
                </span>
            </div>
        </div>
    `).join('');
}

/**
 * Load market trends
 */
async function loadMarketTrends() {
    try {
        const response = await fetch('/api/market-trends');
        if (response.ok) {
            const trends = await response.json();
            displayMarketTrends(trends);
        }
    } catch (error) {
        console.error('Error loading market trends:', error);
    }
}

/**
 * Display market trends
 */
function displayMarketTrends(trends) {
    const container = document.getElementById('marketTrendsContainer');
    
    container.innerHTML = trends.commodities.map(commodity => `
        <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
                <h3 class="font-medium text-gray-900">${commodity.name}</h3>
                <p class="text-sm text-gray-500">${commodity.price} ${commodity.unit}</p>
            </div>
            <div class="text-right">
                <span class="text-sm font-medium ${commodity.trend === 'increasing' ? 'text-green-600' : commodity.trend === 'decreasing' ? 'text-red-600' : 'text-gray-600'}">
                    ${commodity.change_percent > 0 ? '+' : ''}${commodity.change_percent}%
                </span>
                <p class="text-xs text-gray-500">${commodity.trend}</p>
            </div>
        </div>
    `).join('');
}

/**
 * Update field information display
 */
function updateFieldInfo(fieldName, boundary) {
    const container = document.getElementById('fieldInfo');
    
    if (boundary) {
        const area = calculatePolygonArea(boundary);
        container.innerHTML = `
            <p><strong>Name:</strong> ${fieldName}</p>
            <p><strong>Area:</strong> ${area.toFixed(2)} m²</p>
            <p><strong>Status:</strong> Active</p>
        `;
    } else {
        container.innerHTML = '<p>No field selected</p>';
    }
}

/**
 * Update device status display
 */
function updateDeviceStatus(status, details) {
    const container = document.getElementById('deviceStatus');
    
    container.innerHTML = `
        <p><strong>Status:</strong> ${status}</p>
        <p><strong>Details:</strong> ${details}</p>
    `;
}

/**
 * Calculate polygon area (simplified)
 */
function calculatePolygonArea(geojson) {
    if (!geojson || !geojson.coordinates || !geojson.coordinates[0]) return 0;
    
    const coords = geojson.coordinates[0];
    let area = 0;
    
    for (let i = 0; i < coords.length - 1; i++) {
        const j = (i + 1) % (coords.length - 1);
        area += coords[i][0] * coords[j][1];
        area -= coords[j][0] * coords[i][1];
    }
    
    return Math.abs(area) / 2 * 111320 * 111320; // Rough conversion to square meters
}

// Initialize sensor chart
function initializeSensorChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');
    
    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [22, 25, 28, 30, 27, 24],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Humidity (%)',
                    data: [70, 65, 60, 55, 60, 65],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Soil Moisture (%)',
                    data: [45, 44, 43, 42, 43, 44],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

// Initialize chart when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSensorChart();
});

/**
 * Load real-time sensor data from RTDB
 */
async function loadRealtimeSensorData() {
    try {
        const response = await fetch(`${API_BASE}/api/rtdb/sensor-data/latest`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        displayRealtimeSensorData(data);
    } catch (error) {
        console.error('Error loading real-time sensor data:', error);
        showNotification('Failed to load sensor data', 'error');
    }
}

/**
 * Display real-time sensor data
 */
function displayRealtimeSensorData(data) {
    const sensorDataDiv = document.getElementById('sensorData');
    if (!sensorDataDiv) return;

    const { environment, rain, soil, readingId, timestamp } = data;
    
    // Format timestamp
    const timeStr = timestamp ? new Date(timestamp * 1000).toLocaleString() : 'Unknown';
    
    sensorDataDiv.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 class="text-lg font-semibold text-gray-800 mb-3">🌡️ Real-Time Sensor Data</h3>
            <div class="text-sm text-gray-600 mb-3">
                <span class="font-medium">Reading ID:</span> ${readingId}<br>
                <span class="font-medium">Last Updated:</span> ${timeStr}
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Environment Data -->
                <div class="bg-blue-50 p-3 rounded-lg">
                    <h4 class="font-semibold text-blue-800 mb-2">🌤️ Environment</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span>Temperature:</span>
                            <span class="font-medium">${environment.temperature || 'N/A'}°C</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Humidity:</span>
                            <span class="font-medium">${environment.humidity || 'N/A'}%</span>
                        </div>
                    </div>
                </div>

                <!-- Rain Data -->
                <div class="bg-cyan-50 p-3 rounded-lg">
                    <h4 class="font-semibold text-cyan-800 mb-2">🌧️ Rain</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span>Count:</span>
                            <span class="font-medium">${rain.count || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <!-- Soil Data -->
                <div class="bg-green-50 p-3 rounded-lg">
                    <h4 class="font-semibold text-green-800 mb-2">🌱 Soil</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span>Moisture:</span>
                            <span class="font-medium">${soil.moisture || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Humidity:</span>
                            <span class="font-medium">${soil.humidity || 'N/A'}%</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Temperature:</span>
                            <span class="font-medium">${soil.temperature !== -273.14999 ? (soil.temperature || 'N/A') + '°C' : 'Sensor Error'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Load sensor data history for charts
 */
async function loadSensorHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/rtdb/sensor-data/history`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        updateSensorHistoryChart(data.readings);
    } catch (error) {
        console.error('Error loading sensor history:', error);
    }
}

/**
 * Update sensor history chart
 */
function updateSensorHistoryChart(readings) {
    if (!readings || readings.length === 0) return;

    const ctx = document.getElementById('sensorHistoryChart');
    if (!ctx) return;

    // Destroy existing chart
    if (sensorHistoryChart) {
        sensorHistoryChart.destroy();
    }

    // Prepare data for chart
    const labels = readings.map((_, index) => `Reading ${index + 1}`);
    const temperatureData = readings.map(r => r.environment?.temperature || 0);
    const humidityData = readings.map(r => r.environment?.humidity || 0);
    const soilMoistureData = readings.map(r => r.soil?.moisture || 0);

    sensorHistoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: temperatureData,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.1
                },
                {
                    label: 'Humidity (%)',
                    data: humidityData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.1
                },
                {
                    label: 'Soil Moisture',
                    data: soilMoistureData,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Sensor Data History (Last 20 Readings)'
                }
            }
        }
    });
}

/**
 * Start auto-refresh for real-time data
 */
function startAutoRefresh() {
    // Clear any existing interval
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Refresh every 10 minutes (600000ms) to match sensor update frequency
    autoRefreshInterval = setInterval(() => {
        loadRealtimeSensorData();
        loadSensorHistory();
    }, 600000); // 10 minutes
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}
