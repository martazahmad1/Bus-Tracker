// Initialize map and markers as global variables
let map;
let busMarker = null;
let isFirstUpdate = true;
let directionsService;
let routeRenderers = [];
let currentStopIndex = 0;
let showReturnRoute = false;

// Theme handling
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateMapStyle(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateMapStyle(newTheme);
}

function updateMapStyle(theme) {
    if (map) {
        const styles = theme === 'dark' ? [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
                featureType: "administrative.locality",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
            },
            {
                featureType: "poi",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
            },
            {
                featureType: "poi.park",
                elementType: "geometry",
                stylers: [{ color: "#263c3f" }],
            },
            {
                featureType: "poi.park",
                elementType: "labels.text.fill",
                stylers: [{ color: "#6b9a76" }],
            },
            {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ color: "#38414e" }],
            },
            {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#212a37" }],
            },
            {
                featureType: "road",
                elementType: "labels.text.fill",
                stylers: [{ color: "#9ca5b3" }],
            },
            {
                featureType: "road.highway",
                elementType: "geometry",
                stylers: [{ color: "#746855" }],
            },
            {
                featureType: "road.highway",
                elementType: "geometry.stroke",
                stylers: [{ color: "#1f2835" }],
            },
            {
                featureType: "road.highway",
                elementType: "labels.text.fill",
                stylers: [{ color: "#f3d19c" }],
            },
            {
                featureType: "transit",
                elementType: "geometry",
                stylers: [{ color: "#2f3948" }],
            },
            {
                featureType: "transit.station",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
            },
            {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#17263c" }],
            },
            {
                featureType: "water",
                elementType: "labels.text.fill",
                stylers: [{ color: "#515c6d" }],
            },
            {
                featureType: "water",
                elementType: "labels.text.stroke",
                stylers: [{ color: "#17263c" }],
            },
        ] : [];
        
        map.setOptions({ styles: styles });
    }
}

// Define default bus stops
const defaultStops = [
    { name: "GCUF Chiniot", position: { lat: 31.7209, lng: 72.9780 } },
    { name: "Chenab College", position: { lat: 31.7180, lng: 72.9760 } },
    { name: "Jinnah Colony", position: { lat: 31.7150, lng: 72.9740 } },
    { name: "City Terminal", position: { lat: 31.7120, lng: 72.9720 } }
];

// Define route colors
const routeColors = [
    "#2980b9", // Blue
    "#27ae60", // Green
    "#e74c3c", // Red
    "#f39c12", // Orange
];

// Custom marker label class
class MarkerLabel extends google.maps.OverlayView {
    constructor(position, text, map) {
        super();
        this.position = position;
        this.text = text;
        this.setMap(map);
    }

    onAdd() {
        this.div = document.createElement('div');
        this.div.className = 'custom-marker-label';
        this.div.textContent = this.text;
        
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(this.div);
    }

    draw() {
        const overlayProjection = this.getProjection();
        const position = overlayProjection.fromLatLngToDivPixel(this.position);
        
        this.div.style.left = (position.x - 50) + 'px';
        this.div.style.top = (position.y - 50) + 'px';
    }

    onRemove() {
        if (this.div) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
        }
    }
}

// Initialize the map
try {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: { lat: 31.7209, lng: 72.9780 }, // GCUF Chiniot coordinates
        mapTypeId: google.maps.MapTypeId.ROADMAP,
    });

    // Initialize theme
    initTheme();

    // Initialize the Directions service
    directionsService = new google.maps.DirectionsService();

    // Add markers for default stops
    defaultStops.forEach((stop, index) => {
        // Create the marker
        const marker = new google.maps.Marker({
            position: stop.position,
            map: map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: routeColors[index % routeColors.length],
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
            }
        });

        // Create an info window
        const infoWindow = new google.maps.InfoWindow({
            content: `<div class="marker-info-window">
                        <h3>${stop.name}</h3>
                        <p>Stop ${index + 1}</p>
                     </div>`,
            pixelOffset: new google.maps.Size(0, -30)
        });

        // Add hover listener
        marker.addListener('mouseover', () => {
            infoWindow.open(map, marker);
        });

        marker.addListener('mouseout', () => {
            infoWindow.close();
        });

        // Create custom label
        new MarkerLabel(stop.position, stop.name, map);
    });

    // Initialize routes
    updateRoutes();

} catch (error) {
    console.error("Error initializing map:", error);
    document.getElementById("map").innerHTML = '<div class="map-error">Error loading map</div>';
}

// Function to clear all routes
function clearAllRoutes() {
    routeRenderers.forEach(renderer => {
        renderer.setMap(null);
    });
    routeRenderers = [];
}

// Function to update routes
function updateRoutes() {
    clearAllRoutes();

    // Create routes between consecutive stops up to current position
    for (let i = currentStopIndex; i < defaultStops.length - 1; i++) {
        const start = defaultStops[i].position;
        const end = defaultStops[i + 1].position;

        const renderer = new google.maps.DirectionsRenderer({
            map: map,
            polylineOptions: {
                strokeColor: routeColors[i % routeColors.length],
                strokeWeight: 4,
                strokeOpacity: 0.7
            },
            suppressMarkers: true
        });
        routeRenderers.push(renderer);

        const request = {
            origin: start,
            destination: end,
            travelMode: google.maps.TravelMode.DRIVING
        };

        ((currentRenderer) => {
            directionsService.route(request, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    currentRenderer.setDirections(result);
                }
            });
        })(renderer);
    }

    // Show return route if bus is at last stop
    if (showReturnRoute) {
        const returnRenderer = new google.maps.DirectionsRenderer({
            map: map,
            polylineOptions: {
                strokeColor: routeColors[3], // Orange for return route
                strokeWeight: 4,
                strokeOpacity: 0.7
            },
            suppressMarkers: true
        });
        routeRenderers.push(returnRenderer);

        const returnRequest = {
            origin: defaultStops[defaultStops.length - 1].position,
            destination: defaultStops[0].position,
            travelMode: google.maps.TravelMode.DRIVING
        };

        directionsService.route(returnRequest, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                returnRenderer.setDirections(result);
            }
        });
    }

    // Update next stop information
    updateNextStopInfo();
}

// Function to update next stop information
function updateNextStopInfo() {
    const nextStopContainer = document.getElementById("next-stop-container");
    const nextStopName = nextStopContainer.querySelector(".next-stop-name");
    const nextStopEta = nextStopContainer.querySelector(".next-stop-eta");

    if (currentStopIndex < defaultStops.length - 1) {
        const nextStop = defaultStops[currentStopIndex + 1];
        nextStopName.textContent = nextStop.name;
        
        // Calculate ETA (example calculation - you might want to use actual distance/speed)
        const now = new Date();
        const eta = new Date(now.getTime() + 15 * 60000); // Add 15 minutes
        nextStopEta.textContent = `ETA: ${eta.toLocaleTimeString()}`;
    } else if (showReturnRoute) {
        nextStopName.textContent = defaultStops[0].name;
        nextStopEta.textContent = "Returning to first stop";
    } else {
        nextStopName.textContent = "End of Route";
        nextStopEta.textContent = "Route completed";
    }
}

// Function to check if bus is near a stop
function checkNearStop(busPosition) {
    const threshold = 100; // meters
    for (let i = currentStopIndex; i < defaultStops.length; i++) {
        const stop = defaultStops[i];
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(busPosition.lat, busPosition.lng),
            new google.maps.LatLng(stop.position.lat, stop.position.lng)
        );
        
        if (distance <= threshold) {
            if (i === defaultStops.length - 1) {
                // Bus reached last stop
                showReturnRoute = true;
            }
            if (i > currentStopIndex) {
                currentStopIndex = i;
                updateRoutes();
            }
            return true;
        }
    }
    return false;
}

// Function to fetch bus location data from API
async function fetchBusLocation() {
    try {
        const response = await fetch(
            "http://16.171.19.250:5000/get-vertices",
            {
                // Ensure that CORS is handled properly on the backend
            }
        );

        if (!response.ok) {
            throw new Error("Fetching Error");
        }

        const data = await response.json();

        if (data && data.V1 && data.V2) {
            updateBusLocation(data);
        } else {
            throw new Error("Invalid data format received from API");
        }
    } catch (error) {
        console.error(error);
        updateSidebarInfo(null);
    }
}

// Function to start periodic updates
function startPeriodicUpdates() {
    console.log("Starting periodic updates...");
    fetchBusLocation();
    const intervalId = setInterval(fetchBusLocation, 5000);

    window.addEventListener("unload", () => {
        clearInterval(intervalId);
    });
}

// Function to update bus location
function updateBusLocation(locationData) {
    try {
        const latitude = parseFloat(locationData.V1);
        const longitude = parseFloat(locationData.V2);

        if (isNaN(latitude) || isNaN(longitude)) {
            throw new Error("Invalid coordinates received from API");
        }

        const position = { lat: latitude, lng: longitude };

        // Check if bus is near any stop
        checkNearStop(position);

        if (!busMarker) {
            busMarker = new google.maps.Marker({
                position: position,
                map: map,
                icon: {
                    url: 'https://maps.google.com/mapfiles/kml/shapes/bus.png',
                    scaledSize: new google.maps.Size(30, 30)
                },
                title: 'University Bus'
            });

            const infoWindow = new google.maps.InfoWindow({
                content: '<b>University Bus</b>'
            });

            busMarker.addListener('click', () => {
                infoWindow.open(map, busMarker);
            });
        } else {
            animateMarker(busMarker.getPosition(), position);
        }

        if (isFirstUpdate) {
            map.setCenter(position);
            isFirstUpdate = false;
        }

        updateSidebarInfo(locationData);
    } catch (error) {
        console.error("Error updating bus location:", error);
    }
}

// Function to animate marker movement
function animateMarker(startPos, endPos) {
    const frames = 50;
    let frame = 0;

    function animate() {
        frame++;
        const progress = frame / frames;

        const lat = startPos.lat() + (endPos.lat - startPos.lat()) * progress;
        const lng = startPos.lng() + (endPos.lng - startPos.lng()) * progress;

        busMarker.setPosition({ lat, lng });

        if (frame < frames) {
            requestAnimationFrame(animate);
        }
    }

    animate();
}

// Function to update sidebar information
function updateSidebarInfo(locationData) {
    const dataContainer = document.getElementById("data-container");
    const existingCard = document.getElementById("bus-card");

    const cardContent = `
        <h3>Bus Location</h3>
        <p><span class="status-indicator ${locationData ? "status-active" : "status-inactive"}"></span>
            ${locationData ? "Active" : "Connecting..."}</p>
        <p><strong>Last Updated:</strong> ${new Date().toLocaleTimeString()}</p>
        <p><strong>Location:</strong> ${
            locationData
                ? `${locationData.V1}, ${locationData.V2}`
                : "Waiting for data..."
        }</p>
        <p><strong>Current Stop:</strong> ${defaultStops[currentStopIndex].name}</p>
    `;

    if (existingCard) {
        existingCard.innerHTML = cardContent;
    } else {
        const busCard = document.createElement("div");
        busCard.id = "bus-card";
        busCard.className = "location-card";
        busCard.innerHTML = cardContent;

        if (locationData) {
            busCard.addEventListener("click", () => {
                try {
                    const lat = parseFloat(locationData.V1);
                    const lng = parseFloat(locationData.V2);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        map.setCenter({ lat, lng });
                        map.setZoom(15);
                    }
                } catch (error) {
                    console.error("Error centering map:", error);
                }
            });
        }

        dataContainer.appendChild(busCard);
    }

    // Update next stop information
    updateNextStopInfo();
}

// Function to center the map on the current bus location
function centerMap() {
    if (busMarker) {
        const position = busMarker.getPosition();
        map.setCenter(position);
        map.setZoom(17);
    }
}

// Event Listeners
document.getElementById("center-map-btn").addEventListener("click", centerMap);
document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

// Initialize when page loads
window.addEventListener("load", () => {
    startPeriodicUpdates();
    initTheme();
});