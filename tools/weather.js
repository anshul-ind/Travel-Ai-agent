// ============================================================
//  tools/weather.js — Weather Checker
//  Uses Open-Meteo API — completely FREE, no API key needed
//  Docs: https://open-meteo.com/en/docs
//
//  Called by agent.js when Groq triggers checkWeather tool
// ============================================================

const axios = require("axios");

// ─────────────────────────────────────────
//  CITY → COORDINATES MAP
//  Open-Meteo needs lat/lon not city names
// ─────────────────────────────────────────
const CITY_COORDS = {
  // India
  "delhi":      { lat: 28.6139, lon: 77.2090, name: "Delhi" },
  "new delhi":  { lat: 28.6139, lon: 77.2090, name: "New Delhi" },
  "mumbai":     { lat: 19.0760, lon: 72.8777, name: "Mumbai" },
  "goa":        { lat: 15.2993, lon: 74.1240, name: "Goa" },
  "bangalore":  { lat: 12.9716, lon: 77.5946, name: "Bangalore" },
  "bengaluru":  { lat: 12.9716, lon: 77.5946, name: "Bengaluru" },
  "hyderabad":  { lat: 17.3850, lon: 78.4867, name: "Hyderabad" },
  "chennai":    { lat: 13.0827, lon: 80.2707, name: "Chennai" },
  "kolkata":    { lat: 22.5726, lon: 88.3639, name: "Kolkata" },
  "pune":       { lat: 18.5204, lon: 73.8567, name: "Pune" },
  "jaipur":     { lat: 26.9124, lon: 75.7873, name: "Jaipur" },
  "ahmedabad":  { lat: 23.0225, lon: 72.5714, name: "Ahmedabad" },
  "lucknow":    { lat: 26.8467, lon: 80.9462, name: "Lucknow" },
  "kochi":      { lat: 9.9312,  lon: 76.2673, name: "Kochi" },
  "bhopal":     { lat: 23.2599, lon: 77.4126, name: "Bhopal" },
  "nagpur":     { lat: 21.1458, lon: 79.0882, name: "Nagpur" },
  "varanasi":   { lat: 25.3176, lon: 82.9739, name: "Varanasi" },
  "amritsar":   { lat: 31.6340, lon: 74.8723, name: "Amritsar" },
  "leh":        { lat: 34.1526, lon: 77.5771, name: "Leh" },
  "srinagar":   { lat: 34.0837, lon: 74.7973, name: "Srinagar" },
  // International
  "dubai":      { lat: 25.2048, lon: 55.2708, name: "Dubai" },
  "london":     { lat: 51.5074, lon: -0.1278, name: "London" },
  "new york":   { lat: 40.7128, lon: -74.0060, name: "New York" },
  "singapore":  { lat: 1.3521,  lon: 103.8198, name: "Singapore" },
  "bangkok":    { lat: 13.7563, lon: 100.5018, name: "Bangkok" },
  "paris":      { lat: 48.8566, lon: 2.3522,  name: "Paris" },
  "tokyo":      { lat: 35.6762, lon: 139.6503, name: "Tokyo" },
};

// ─────────────────────────────────────────
//  WMO WEATHER CODE → DESCRIPTION
//  Open-Meteo returns numeric weather codes
// ─────────────────────────────────────────
const WMO_CODES = {
  0:  { desc: "Clear sky",            icon: "Sunny" },
  1:  { desc: "Mainly clear",         icon: "Mostly sunny" },
  2:  { desc: "Partly cloudy",        icon: "Partly cloudy" },
  3:  { desc: "Overcast",             icon: "Cloudy" },
  45: { desc: "Foggy",                icon: "Foggy" },
  48: { desc: "Icy fog",              icon: "Foggy" },
  51: { desc: "Light drizzle",        icon: "Drizzle" },
  53: { desc: "Moderate drizzle",     icon: "Drizzle" },
  55: { desc: "Heavy drizzle",        icon: "Drizzle" },
  61: { desc: "Slight rain",          icon: "Rainy" },
  63: { desc: "Moderate rain",        icon: "Rainy" },
  65: { desc: "Heavy rain",           icon: "Heavy rain" },
  71: { desc: "Slight snowfall",      icon: "Snowy" },
  73: { desc: "Moderate snowfall",    icon: "Snowy" },
  75: { desc: "Heavy snowfall",       icon: "Heavy snow" },
  80: { desc: "Slight rain showers",  icon: "Showery" },
  81: { desc: "Moderate rain showers",icon: "Showery" },
  82: { desc: "Heavy rain showers",   icon: "Heavy showers" },
  95: { desc: "Thunderstorm",         icon: "Thunderstorm" },
  99: { desc: "Thunderstorm w/ hail", icon: "Severe storm" },
};

// ─────────────────────────────────────────
//  TRAVEL ADVICE based on conditions
// ─────────────────────────────────────────
function getTravelAdvice(tempMax, weatherCode) {
  if (weatherCode >= 95)  return "Severe weather expected. Consider rescheduling.";
  if (weatherCode >= 71)  return "Snow likely. Pack warm clothes and waterproofs.";
  if (weatherCode >= 61)  return "Rain expected. Pack an umbrella and light waterproof.";
  if (weatherCode >= 51)  return "Light drizzle possible. Carry a small umbrella.";
  if (tempMax >= 38)      return "Very hot day. Stay hydrated and wear sunscreen.";
  if (tempMax >= 32)      return "Hot and sunny. Light clothes recommended.";
  if (tempMax >= 22)      return "Pleasant weather. Great time to travel!";
  if (tempMax >= 15)      return "Mild weather. A light jacket may be useful.";
  return "Cool weather. Pack warm layers.";
}

// ─────────────────────────────────────────
//  MAIN: checkWeather()
// ─────────────────────────────────────────
async function checkWeather({ city, date }) {
  console.log(`\n  [weather.js] checkWeather(${city}, ${date})\n`);

  // Resolve city to coordinates
  const coords = CITY_COORDS[city.toLowerCase().trim()];
  if (!coords) {
    return {
      error: true,
      message: `Unknown city "${city}". Try a major city name like "Goa", "Delhi", "Mumbai".`,
    };
  }

  // Default to today if no date
  const targetDate = date || new Date().toISOString().split("T")[0];

  try {
    const res = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude:       coords.lat,
        longitude:      coords.lon,
        daily:          [
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_sum",
          "weathercode",
          "windspeed_10m_max",
          "uv_index_max",
        ].join(","),
        timezone:       "Asia/Kolkata",
        start_date:     targetDate,
        end_date:       targetDate,
        forecast_days:  16,
      },
    });

    const daily = res.data.daily;

    // Find the index for our target date
    const dateIndex = daily.time.indexOf(targetDate);

    if (dateIndex === -1) {
      return {
        error: true,
        message: `No weather data for ${targetDate}. Open-Meteo supports up to 16 days ahead.`,
        suggestion: "Use a date within the next 16 days.",
      };
    }

    const tempMax     = Math.round(daily.temperature_2m_max[dateIndex]);
    const tempMin     = Math.round(daily.temperature_2m_min[dateIndex]);
    const precipitation = daily.precipitation_sum[dateIndex]?.toFixed(1) || "0.0";
    const weatherCode = daily.weathercode[dateIndex];
    const windspeed   = Math.round(daily.windspeed_10m_max[dateIndex]);
    const uvIndex     = daily.uv_index_max[dateIndex]?.toFixed(1) || "N/A";
    const condition   = WMO_CODES[weatherCode] || { desc: "Unknown", icon: "Unknown" };
    const advice      = getTravelAdvice(tempMax, weatherCode);

    return {
      success:     true,
      city:        coords.name,
      date:        targetDate,
      condition:   condition.desc,
      icon:        condition.icon,
      tempMax,
      tempMin,
      precipitation: `${precipitation}mm`,
      windspeed:   `${windspeed} km/h`,
      uvIndex,
      advice,
      summary: `${coords.name} on ${targetDate}: ${condition.desc}, ${tempMin}°C – ${tempMax}°C. ${advice}`,
    };

  } catch (err) {
    return {
      error:      true,
      message:    err.message,
      suggestion: "Check your internet connection. Open-Meteo requires no API key.",
    };
  }
}

// ─────────────────────────────────────────
//  QUICK TEST — run: node tools/weather.js
// ─────────────────────────────────────────
async function test() {
  console.log("Testing Open-Meteo weather...\n");

  const result = await checkWeather({
    city: "Goa",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString().split("T")[0], // 7 days from now
  });

  if (result.error) {
    console.error("Error:", result.message);
  } else {
    console.log(`City:        ${result.city}`);
    console.log(`Date:        ${result.date}`);
    console.log(`Condition:   ${result.condition}`);
    console.log(`Temperature: ${result.tempMin}°C – ${result.tempMax}°C`);
    console.log(`Rain:        ${result.precipitation}`);
    console.log(`Wind:        ${result.windspeed}`);
    console.log(`UV Index:    ${result.uvIndex}`);
    console.log(`Advice:      ${result.advice}`);
    console.log(`\nSummary: ${result.summary}`);
  }
}

if (require.main === module) test();

module.exports = { checkWeather };