"use strict";

// The coordinates here are illustrative city-center locations.
const cities = [
  
];

// Google Maps Tile Layers (Hybrid Satellite, Pure Satellite, and Street Map)
const googleHybridLayer = L.tileLayer(
  "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  {
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "&copy; Google Maps",
  }
);

const googleSatelliteLayer = L.tileLayer(
  "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  {
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "&copy; Google Maps",
  }
);

const googleStreetLayer = L.tileLayer(
  "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  {
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "&copy; Google Maps",
  }
);

const map = L.map("map", {
  center: [11.2, 123.0],
  zoom: 6,
  layers: [googleHybridLayer],
});

L.control
  .layers({
    "Google Hybrid (Satellite + Labels)": googleHybridLayer,
    "Google Satellite (Pure)": googleSatelliteLayer,
    "Google Street Map": googleStreetLayer,
  })
  .addTo(map);

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

// Picks 1 forecast entry per day (preferring 12:00 PM) for the next 5 days
function extractDailyForecast(forecastList) {
  const dailyMap = new Map();
  const todayStr = new Date().toISOString().split("T")[0];

  for (const item of forecastList) {
    const [datePart, timePart] = item.dt_txt.split(" ");
    if (datePart === todayStr) continue;

    if (!dailyMap.has(datePart) || timePart === "12:00:00") {
      dailyMap.set(datePart, item);
    }
  }

  return Array.from(dailyMap.values()).slice(0, 5);
}

// Renders both current weather AND the 5-day forecast cards
function weatherView(location, currentData, forecastData) {
  const container = document.createElement("div");

  // 1. Current Weather Card
  const card = document.createElement("div");
  card.className = "weather-card";
  const description = currentData.weather?.[0]?.description ?? "Not available";
  const icon = currentData.weather?.[0]?.icon ?? "";
  if (/^\d{2}[dn]$/.test(icon)) {
    const image = document.createElement("img");
    image.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
    image.alt = description;
    card.append(image);
  }
  const info = document.createElement("div");
  info.append(textElement("strong", location.name));
  info.append(
    textElement(
      "div",
      `Lat: ${location.lat.toFixed(4)}, Lon: ${location.lon.toFixed(4)}`
    )
  );
  info.append(textElement("div", description));
  info.append(
    textElement("div", `Temperature: ${currentData.main.temp.toFixed(1)} °C`)
  );
  info.append(
    textElement(
      "div",
      `Feels like: ${currentData.main.feels_like.toFixed(1)} °C`
    )
  );
  info.append(textElement("div", `Humidity: ${currentData.main.humidity}%`));
  info.append(
    textElement("div", `Wind: ${currentData.wind?.speed ?? "N/A"} m/s`)
  );
  card.append(info);
  container.append(card);

  // 2. 5-Day Forecast Section
  const dailyItems = extractDailyForecast(forecastData?.list ?? []);
  if (dailyItems.length > 0) {
    const forecastHeading = textElement("h3", "5-Day Forecast");
    forecastHeading.style.marginTop = "1rem";
    container.append(forecastHeading);

    const grid = document.createElement("div");
    grid.className = "forecast-grid";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(120px, 1fr))";
    grid.style.gap = "0.75rem";
    grid.style.marginTop = "0.5rem";

    dailyItems.forEach((day) => {
      const dayCard = document.createElement("div");
      dayCard.className = "weather-card forecast-item";
      dayCard.style.padding = "0.6rem";
      dayCard.style.textAlign = "center";
      dayCard.style.flexDirection = "column";

      const dateObj = new Date(day.dt * 1000);
      const dayLabel = dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      dayCard.append(textElement("strong", dayLabel));

      const dayIcon = day.weather?.[0]?.icon ?? "";
      const dayDesc = day.weather?.[0]?.description ?? "";
      if (/^\d{2}[dn]$/.test(dayIcon)) {
        const img = document.createElement("img");
        img.src = `https://openweathermap.org/img/wn/${dayIcon}.png`;
        img.alt = dayDesc;
        img.style.margin = "0 auto";
        dayCard.append(img);
      }

      dayCard.append(textElement("div", `${day.main.temp.toFixed(1)} °C`));
      dayCard.append(textElement("small", dayDesc));
      grid.append(dayCard);
    });

    container.append(grid);
  }

  return container;
}

// Fetches current weather + 5-day forecast in parallel
async function getWeatherAndForecast(location) {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) throw new Error("Enter your OpenWeather API key first.");

  const cacheId = `${location.lat.toFixed(4)},${location.lon.toFixed(4)}|${apiKey}`;
  const saved = cache.get(cacheId);
  if (saved && Date.now() - saved.time < CACHE_MS) return saved.data;

  const currentUrl = new URL("https://api.openweathermap.org/data/2.5/weather");
  currentUrl.searchParams.set("lat", location.lat);
  currentUrl.searchParams.set("lon", location.lon);
  currentUrl.searchParams.set("units", "metric");
  currentUrl.searchParams.set("appid", apiKey);

  const forecastUrl = new URL(
    "https://api.openweathermap.org/data/2.5/forecast"
  );
  forecastUrl.searchParams.set("lat", location.lat);
  forecastUrl.searchParams.set("lon", location.lon);
  forecastUrl.searchParams.set("units", "metric");
  forecastUrl.searchParams.set("appid", apiKey);

  const [currentRes, forecastRes] = await Promise.all([
    fetch(currentUrl),
    fetch(forecastUrl),
  ]);

  if (!currentRes.ok) {
    if (currentRes.status === 401)
      throw new Error(
        "API key rejected (401). Verify your key and product access."
      );
    if (currentRes.status === 429)
      throw new Error("Request limit exceeded (429). Try again later.");
    throw new Error(`Weather request failed (HTTP ${currentRes.status}).`);
  }

  const current = await currentRes.json();
  if (!current.main || typeof current.main.temp !== "number") {
    throw new Error(
      "Unexpected response: temperature information was missing."
    );
  }

  const forecast = forecastRes.ok ? await forecastRes.json() : { list: [] };
  const combined = { current, forecast };

  cache.set(cacheId, { time: Date.now(), data: combined });
  return combined;
}

// [CHANGED]: marker parameter is now optional (defaults to null)
async function showWeather(location, marker = null) {
  const requestId = ++activeRequest;
  const coordsText = `Lat: ${location.lat.toFixed(4)}, Lon: ${location.lon.toFixed(4)}`;

  setStatus(`Loading weather & forecast for ${location.name} (${coordsText})…`);
  if (marker) {
    marker
      .setPopupContent(`${location.name} (${coordsText}): Loading weather…`)
      .openPopup();
  }

  try {
    const { current, forecast } = await getWeatherAndForecast(location);
    if (requestId !== activeRequest) return;

    const resolvedLocation = {
      ...location,
      name: location.isCustom
        ? current.name || "Selected Location"
        : location.name,
    };

    weatherDetails.replaceChildren(
      weatherView(resolvedLocation, current, forecast)
    );

    if (marker) {
      const popup = document.createElement("div");
      popup.append(textElement("h3", resolvedLocation.name));
      popup.append(textElement("p", coordsText));
      popup.append(
        textElement(
          "p",
          `${current.main.temp.toFixed(1)} °C — ${
            current.weather?.[0]?.description ?? "Current weather"
          }`
        )
      );
      popup.append(textElement("p", `Humidity: ${current.main.humidity}%`));

      marker.setPopupContent(popup).openPopup();
    }

    setStatus(`Showing weather & 5-day forecast for ${resolvedLocation.name}.`);
  } catch (error) {
    if (requestId !== activeRequest) return;
    if (marker) {
      marker
        .setPopupContent(`${location.name} (${coordsText}): Weather unavailable.`)
        .openPopup();
    }
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

// 2. Click anywhere on the map: loads weather & forecast without adding any marker
map.on("click", (e) => {
  const { lat, lng } = e.latlng;
  const clickedLocation = {
    name: "Selected Location",
    lat,
    lon: lng,
    isCustom: true,
  };

  showWeather(clickedLocation);
});

// 3. Search functionality
const form = document.getElementById("searchForm");
const input = document.getElementById("cityInput");
const searchMarkerLayer = L.layerGroup().addTo(map);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = input.value.trim();
  if (city.length < 2) return;

  searchMarkerLayer.clearLayers();
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
    if (!response.ok)
      throw new Error(`Geocoding failed (HTTP ${response.status})`);

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
      marker.bindPopup(
        `<strong>${displayName}</strong><br>${coordsText}<br><em>Click pin to load weather</em>`
      );

      marker.on("click", () => showWeather(locationObj, marker));

      if (index === 0) {
        primaryResult = { locationObj, marker };
      }
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 11);
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    if (primaryResult) {
      await showWeather(primaryResult.locationObj, primaryResult.marker);
    }
  } catch (error) {
    setStatus(error.message);
  }
});