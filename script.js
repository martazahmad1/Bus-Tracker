// Initialize map and markers as global variables
let map;
let busMarker = null;
let isFirstUpdate = true;
let directionsService;
let directionsRenderer1;
let directionsRenderer2;

// Initialize the map
try {
  // Initialize the map
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

  // Define waypoints for the first route
  const route1Waypoints = [
    { location: { lat: 31.7550, lng: 72.9692 } }, // Via Chiniot Road
    { location: { lat: 31.7689, lng: 72.9520 } }, // Intermediate point
    { location: { lat: 31.7831, lng: 72.9350 } }, // Intermediate point
  ];

  // Define waypoints for the second route
  const route2Waypoints = [
    { location: { lat: 31.8312, lng: 72.9012 } }, // Via Chenab Road
    { location: { lat: 31.8456, lng: 72.8891 } }, // Intermediate point
    { location: { lat: 31.8567, lng: 72.8789 } }, // Intermediate point
  ];

  // Calculate and display the first route
  const route1Request = {
    origin: { lat: 31.6991, lng: 72.9782 }, // GCUF Chiniot
    destination: { lat: 31.7529, lng: 72.9115 }, // Aqsa Chowk Rabwah
    waypoints: route1Waypoints,
    travelMode: google.maps.TravelMode.DRIVING
  };

  directionsService.route(route1Request, (result, status) => {
    if (status === google.maps.DirectionsStatus.OK) {
      directionsRenderer1.setDirections(result);
    }
  });

  // Calculate and display the second route
  const route2Request = {
    origin: { lat: 31.7529, lng: 72.9115 }, // Aqsa Chowk Rabwah
    destination: { lat: 31.7849, lng: 72.8857 }, // Ahmad Nagar
    waypoints: route2Waypoints,
    travelMode: google.maps.TravelMode.DRIVING
  };

  directionsService.route(route2Request, (result, status) => {
    if (status === google.maps.DirectionsStatus.OK) {
      directionsRenderer2.setDirections(result);
    }
  });

  // Add markers for important locations
  new google.maps.Marker({
    position: { lat: 31.6991, lng: 72.9782 },
    map: map,
    title: "GCUF Chiniot",
    label: "GCUF"
  });

  new google.maps.Marker({
    position: { lat: 31.7529, lng: 72.9115 },
    map: map,
    title: "Aqsa Chowk Rabwah",
    label: "AqsaChowk"
  });

  new google.maps.Marker({
    position: { lat: 31.7849, lng: 72.8857 },
    map: map,
    title: "Ahmad Nagar",
    label: "Ahmad Nagar"
  });

} catch (error) {
  console.error("Error initializing map:", error);
  document.getElementById("map").innerHTML =
    '<div class="map-error">Error loading map</div>';
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

    if (!busMarker) {
      // Create the bus marker with a custom icon
      busMarker = new google.maps.Marker({
        position: position,
        map: map,
        icon: {
          url: 'https://maps.google.com/mapfiles/kml/shapes/bus.png',
          scaledSize: new google.maps.Size(30, 30)
        },
        title: 'University Bus'
      });

      // Add info window for the bus
      const infoWindow = new google.maps.InfoWindow({
        content: '<b>University Bus</b>'
      });

      busMarker.addListener('click', () => {
        infoWindow.open(map, busMarker);
      });
    } else {
      // Animate the marker movement
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
      <p><span class="status-indicator ${
        locationData ? "status-active" : "status-inactive"
      }"></span> 
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

// Add event listener to the center button
document.getElementById("center-map-btn").addEventListener("click", centerMap);

// Initialize when page loads
window.addEventListener("load", startPeriodicUpdates);