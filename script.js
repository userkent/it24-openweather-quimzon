"use strict";

// The coordinates here are illustrative city-center locations.
const cities = [
  
];

const map = L.map("map").setView([11.2, 123.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const apiKeyInput = document.getElementById("apiKey");
const status = document.getElementById("status");
const weatherDetails = document.getElementById("weatherDetails");
const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;
let activeRequest = 0;

function setStatus(message) {
  status.textContent = message;
}

function textElement(tag, content) {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}

function weatherView(location, data) {
  const card = document.createElement("div");
  card.className = "weather-card";
  const description = data.weather?.[0]?.description ?? "Not available";
  const icon = data.weather?.[0]?.icon ?? "";
  if (/^\d{2}[dn]$/.test(icon)) {
    const image = document.createElement("img");
    image.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
    image.alt = description;
    card.append(image);
  }
  const info = document.createElement("div");
  info.append(textElement("strong", location.name));
  // Display Latitude & Longitude
  info.append(
    textElement(
      "div",
      `Lat: ${location.lat.toFixed(4)}, Lon: ${location.lon.toFixed(4)}`
    )
  );
  info.append(textElement("div", description));
  info.append(
    textElement("div", `Temperature: ${data.main.temp.toFixed(1)} °C`)
  );
  info.append(
    textElement("div", `Feels like: ${data.main.feels_like.toFixed(1)} °C`)
  );
  info.append(textElement("div", `Humidity: ${data.main.humidity}%`));
  info.append(textElement("div", `Wind: ${data.wind?.speed ?? "N/A"} m/s`));
  card.append(info);
  return card;
}

async function getCurrentWeather(location) {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) throw new Error("Enter your OpenWeather API key first.");

  // Cache results by rounded coordinates and API key for 10 minutes
  const cacheId = `${location.lat.toFixed(4)},${location.lon.toFixed(4)}|${apiKey}`;
  const saved = cache.get(cacheId);
  if (saved && Date.now() - saved.time < CACHE_MS) return saved.data;

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", location.lat);
  url.searchParams.set("lon", location.lon);
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 401)
      throw new Error(
        "API key rejected (401). Verify your key and product access."
      );
    if (response.status === 429)
      throw new Error("Request limit exceeded (429). Try again later.");
    throw new Error(`Weather request failed (HTTP ${response.status}).`);
  }
  const data = await response.json();
  if (!data.main || typeof data.main.temp !== "number") {
    throw new Error(
      "Unexpected response: temperature information was missing."
    );
  }
  cache.set(cacheId, { time: Date.now(), data });
  return data;
}

async function showWeather(location, marker) {
  const requestId = ++activeRequest;
  const coordsText = `Lat: ${location.lat.toFixed(4)}, Lon: ${location.lon.toFixed(4)}`;

  setStatus(`Loading weather for ${location.name} (${coordsText})…`);
  marker
    .setPopupContent(`${location.name} (${coordsText}): Loading weather…`)
    .openPopup();

  try {
    const data = await getCurrentWeather(location);
    if (requestId !== activeRequest) return;

    // Use the API's returned location name if it was an arbitrary map click
    const resolvedLocation = {
      ...location,
      name: location.isCustom ? data.name || "Selected Location" : location.name,
    };

    weatherDetails.replaceChildren(weatherView(resolvedLocation, data));

    const popup = document.createElement("div");
    popup.append(textElement("h3", resolvedLocation.name));
    popup.append(textElement("p", coordsText));
    popup.append(
      textElement(
        "p",
        `${data.main.temp.toFixed(1)} °C — ${
          data.weather?.[0]?.description ?? "Current weather"
        }`
      )
    );
    popup.append(textElement("p", `Humidity: ${data.main.humidity}%`));

    marker.setPopupContent(popup).openPopup();
    setStatus(`Showing current weather for ${resolvedLocation.name}.`);
  } catch (error) {
    if (requestId !== activeRequest) return;
    marker
      .setPopupContent(`${location.name} (${coordsText}): Weather unavailable.`)
      .openPopup();
    weatherDetails.textContent = error.message;
    setStatus(error.message);
  }
}

// 1. Pre-defined city markers
cities.forEach((city) => {
  const marker = L.marker([city.lat, city.lon]).addTo(map);
  marker.bindTooltip(city.name);
  marker.bindPopup(`${city.name}: Click to load weather`);
  marker.on("click", () => showWeather(city, marker));
});

// 2. Click anywhere on the map to add a marker with latitude/longitude & weather
// [CHANGED]: Creates a new marker per click so previous clicked pins stay on the map
map.on("click", (e) => {
  const { lat, lng } = e.latlng;
  const clickedLocation = {
    name: "Selected Location",
    lat,
    lon: lng,
    isCustom: true,
  };

  const marker = L.marker([lat, lng]).addTo(map);
  marker.bindPopup("Loading...");
  marker.on("click", () => showWeather(clickedLocation, marker));

  showWeather(clickedLocation, marker);
});

// 3. Search functionality
// [ADDED]: Defined form, input, and searchMarkerLayer (these were missing in your last file)
const form = document.getElementById("searchForm");
const input = document.getElementById("cityInput");
const searchMarkerLayer = L.layerGroup().addTo(map);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = input.value.trim();
  if (city.length < 2) return;

  // [REMOVED]: searchMarkerLayer.clearLayers(); so previous search pins are NOT deleted
  setStatus(`Searching for "${city}"…`);

  try {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search?" +
      new URLSearchParams({
        name: city,
        count: "5",
        language: "en",
        format: "json",
      });

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Geocoding failed (HTTP ${response.status})`);

    const data = await response.json();
    const locations = data.results ?? [];

    if (locations.length === 0) {
      setStatus(`No locations found matching "${city}".`);
      return;
    }

    const bounds = [];
    let primaryResult = null;

    locations.forEach((place, index) => {
      const coords = [place.latitude, place.longitude];
      bounds.push(coords);

      const displayName = [place.name, place.admin1, place.country]
        .filter(Boolean)
        .join(", ");

      const coordsText = `Lat: ${place.latitude.toFixed(4)}, Lon: ${place.longitude.toFixed(4)}`;

      const locationObj = {
        name: displayName,
        lat: place.latitude,
        lon: place.longitude,
        isCustom: false,
      };

      const marker = L.marker(coords).addTo(searchMarkerLayer);
      marker.bindTooltip(displayName);

      // Give every marker immediate location info in its popup
      marker.bindPopup(
        `<strong>${displayName}</strong><br>${coordsText}<br><em>Click pin to load weather</em>`
      );

      marker.on("click", () => showWeather(locationObj, marker));

      // Save the #1 best match (Open-Meteo sorts results by population/relevance)
      if (index === 0) {
        primaryResult = { locationObj, marker };
      }
    });

    // Zoom the map first so the popup doesn't get cut off or closed during panning
    if (bounds.length === 1) {
      map.setView(bounds[0], 11);
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    // Automatically open the #1 match and load its weather details
    if (primaryResult) {
      await showWeather(primaryResult.locationObj, primaryResult.marker);
    }
  } catch (error) {
    setStatus(error.message);
  }
});