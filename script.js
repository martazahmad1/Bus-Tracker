// Initialize map and markers as global variables
let map;
let busMarker = null;
let isFirstUpdate = true;
let directionsService;
let directionsRenderer1;
let directionsRenderer2;
let isAdmin = false;
let isAddingStop = false;
let tempMarker = null;
let busStops = [];
let routeRenderers = []; // Array to store multiple route renderers
let showReturnRoute = false; // Flag to control return route visibility

// Admin password (in a real application, this should be handled securely on the server)
const ADMIN_PASSWORD = "hello";

// Initialize the map
try {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: { lat: 31.7209, lng: 72.9780 }, // GCUF Chiniot coordinates
        mapTypeId: google.maps.MapTypeId.ROADMAP,
    });

    // Initialize the Directions service and renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer1 = new google.maps.DirectionsRenderer({
        map: map,
        polylineOptions: {
            strokeColor: "#2980b9",
            strokeWeight: 6,
            strokeOpacity: 0.8
        }
    });
    directionsRenderer2 = new google.maps.DirectionsRenderer({
        map: map,
        polylineOptions: {
            strokeColor: "#27ae60",
            strokeWeight: 3,
            strokeOpacity: 0.7
        }
    });

    // Add click event listener to map for adding stops
    map.addListener('click', function(e) {
        if (isAddingStop) {
            const position = e.latLng;
            if (tempMarker) {
                tempMarker.setMap(null);
            }
            tempMarker = new google.maps.Marker({
                position: position,
                map: map,
                draggable: true
            });
        }
    });

} catch (error) {
    console.error("Error initializing map:", error);
    document.getElementById("map").innerHTML = '<div class="map-error">Error loading map</div>';
}

// Admin Panel Functions
function showAdminLogin() {
    document.getElementById('adminLoginOverlay').style.display = 'flex';
}

function login() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        isAdmin = true;
        document.getElementById('adminLoginOverlay').style.display = 'none';
        document.getElementById('admin-panel').classList.remove('hidden');
        document.getElementById('adminPassword').value = '';
    } else {
        alert('Invalid password');
    }
}

function logout() {
    isAdmin = false;
    document.getElementById('admin-panel').classList.add('hidden');
    cancelAddStop();
}

function showAddStopForm() {
    document.getElementById('add-stop-form').classList.remove('hidden');
    document.getElementById('stops-list').classList.add('hidden');
    isAddingStop = true;
}

function cancelAddStop() {
    isAddingStop = false;
    if (tempMarker) {
        tempMarker.setMap(null);
        tempMarker = null;
    }
    document.getElementById('add-stop-form').classList.add('hidden');
    document.getElementById('stop-name').value = '';
}

function saveStop() {
    if (!tempMarker) {
        alert('Please select a location on the map');
        return;
    }

    const stopName = document.getElementById('stop-name').value;
    if (!stopName) {
        alert('Please enter a stop name');
        return;
    }

    const position = tempMarker.getPosition();
    const newStop = {
        name: stopName,
        position: {
            lat: position.lat(),
            lng: position.lng()
        }
    };

    busStops.push(newStop);
    
    // Create a permanent marker for the stop
    new google.maps.Marker({
        position: newStop.position,
        map: map,
        title: newStop.name,
        label: newStop.name
    });

    // Update routes
    updateRoutes();

    // Clear form and temporary marker
    cancelAddStop();
    showStopsList();
}

function showStopsList() {
    const stopsList = document.getElementById('stops-list');
    stopsList.classList.remove('hidden');
    document.getElementById('add-stop-form').classList.add('hidden');

    // Clear existing list
    stopsList.innerHTML = '<h3>Bus Stops</h3>';

    // Add each stop to the list
    busStops.forEach((stop, index) => {
        const stopItem = document.createElement('div');
        stopItem.className = 'stop-item';
        stopItem.innerHTML = `
            <span>${stop.name}</span>
            <button onclick="deleteStop(${index})">Delete</button>
        `;
        stopsList.appendChild(stopItem);
    });
}

function deleteStop(index) {
    if (confirm('Are you sure you want to delete this stop?')) {
        busStops.splice(index, 1);
        updateRoutes();
        showStopsList();
    }
}

function clearAllRoutes() {
    // Clear existing route renderers
    routeRenderers.forEach(renderer => {
        renderer.setMap(null);
    });
    routeRenderers = [];
}

function updateRoutes() {
    if (busStops.length < 2) return;

    // Clear all existing routes
    clearAllRoutes();

    // Define an array of colors for different route segments
    const routeColors = [
        "#2980b9", // Blue
        "#27ae60", // Green
        "#e74c3c", // Red
        "#f39c12", // Orange
        "#8e44ad", // Purple
        "#16a085", // Teal
        "#d35400", // Dark Orange
        "#2c3e50", // Navy
        "#c0392b", // Dark Red
        "#1abc9c"  // Turquoise
    ];

    // Create a route between each consecutive pair of stops
    for (let i = 0; i < busStops.length - 1; i++) {
        const start = busStops[i].position;
        const end = busStops[i + 1].position;

        // Create a new renderer for this route segment
        const renderer = new google.maps.DirectionsRenderer({
            map: map,
            polylineOptions: {
                strokeColor: routeColors[i % routeColors.length], // Cycle through colors
                strokeWeight: 4,
                strokeOpacity: 0.7
            },
            suppressMarkers: true // Don't show default markers
        });
        routeRenderers.push(renderer);

        // Calculate route for this segment
        const routeRequest = {
            origin: start,
            destination: end,
            travelMode: google.maps.TravelMode.DRIVING
        };

        // Use closure to maintain correct renderer reference
        ((currentRenderer) => {
            directionsService.route(routeRequest, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    currentRenderer.setDirections(result);
                }
            });
        })(renderer);
    }

    // Only show return route if bus has reached last stop
    if (showReturnRoute && busStops.length >= 2) {
        const returnRenderer = new google.maps.DirectionsRenderer({
            map: map,
            polylineOptions: {
                strokeColor: routeColors[busStops.length - 1 % routeColors.length],
                strokeWeight: 4,
                strokeOpacity: 0.7
            },
            suppressMarkers: true
        });
        routeRenderers.push(returnRenderer);

        const returnRequest = {
            origin: busStops[busStops.length - 1].position,
            destination: busStops[0].position,
            travelMode: google.maps.TravelMode.DRIVING
        };

        directionsService.route(returnRequest, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                returnRenderer.setDirections(result);
            }
        });
    }
}

// Function to check if bus is near the last stop
function isNearLastStop(busPosition) {
    if (busStops.length === 0) return false;
    
    const lastStop = busStops[busStops.length - 1].position;
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(busPosition.lat, busPosition.lng),
        new google.maps.LatLng(lastStop.lat, lastStop.lng)
    );
    
    // If bus is within 100 meters of last stop
    return distance <= 100;
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

        // Check if bus has reached last stop
        const busAtLastStop = isNearLastStop(position);
        if (busAtLastStop && !showReturnRoute) {
            showReturnRoute = true;
            updateRoutes(); // Update routes to show return path
        } else if (!busAtLastStop && showReturnRoute) {
            showReturnRoute = false;
            updateRoutes(); // Update routes to hide return path
        }

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
document.getElementById("admin-btn").addEventListener("click", showAdminLogin);
document.getElementById("logout-btn").addEventListener("click", logout);
document.getElementById("add-stop-btn").addEventListener("click", showAddStopForm);
document.getElementById("view-stops-btn").addEventListener("click", showStopsList);
document.getElementById("save-stop-btn").addEventListener("click", saveStop);
document.getElementById("cancel-add-stop").addEventListener("click", cancelAddStop);

// Initialize when page loads
window.addEventListener("load", startPeriodicUpdates);