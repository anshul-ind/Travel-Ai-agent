// ============================================================
//  flights.js — Real Flight Search via Aviationstack
//  Replaces amadeus-travel.js
//
//  Setup:
//    1. Go to https://aviationstack.com → Sign Up Free
//    2. Copy your API Access Key from dashboard
//    3. Add to .env: AVIATIONSTACK_API_KEY=your_key
//
//  Free tier: 100 calls/month (enough for development)
//  Docs: https://aviationstack.com/documentation
// ============================================================

require("dotenv").config();
const axios = require("axios");

const BASE_URL = "http://api.aviationstack.com/v1";

// ─────────────────────────────────────────
//  CITY → IATA CODE MAP
//  Aviationstack needs IATA codes
// ─────────────────────────────────────────
const CITY_TO_IATA = {
  // India
  "delhi":       "DEL",  "new delhi":  "DEL",
  "mumbai":      "BOM",  "bombay":     "BOM",
  "bangalore":   "BLR",  "bengaluru":  "BLR",
  "goa":         "GOI",
  "hyderabad":   "HYD",
  "chennai":     "MAA",  "madras":     "MAA",
  "kolkata":     "CCU",  "calcutta":   "CCU",
  "pune":        "PNQ",
  "ahmedabad":   "AMD",
  "jaipur":      "JAI",
  "lucknow":     "LKO",
  "kochi":       "COK",  "cochin":     "COK",
  "chandigarh":  "IXC",
  "bhopal":      "BHO",
  "nagpur":      "NAG",
  "varanasi":    "VNS",
  "amritsar":    "ATQ",
  "patna":       "PAT",
  "ranchi":      "IXR",
  "indore":      "IDR",
  "srinagar":    "SXR",
  "leh":         "IXL",
  // International
  "dubai":       "DXB",
  "london":      "LHR",
  "new york":    "JFK",
  "singapore":   "SIN",
  "bangkok":     "BKK",
  "paris":       "CDG",
  "tokyo":       "NRT",
  "sydney":      "SYD",
  "toronto":     "YYZ",
};

function resolveIATA(cityOrCode) {
  if (!cityOrCode) return null;
  const trimmed = cityOrCode.trim();
  // Already a valid IATA code
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  // Lookup city name
  const code = CITY_TO_IATA[trimmed.toLowerCase()];
  if (!code) {
    throw new Error(
      `Unknown city "${trimmed}". Try using the IATA code directly (e.g. DEL, GOI, BOM).`
    );
  }
  return code;
}

// ─────────────────────────────────────────
//  DURATION CALCULATOR
// ─────────────────────────────────────────
function calcDuration(dep, arr) {
  try {
    const diff = (new Date(arr) - new Date(dep)) / 60000; // minutes
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  } catch {
    return "N/A";
  }
}

// ─────────────────────────────────────────
//  FORMAT TIME  "2026-04-20T08:30:00+00:00" → "08:30"
// ─────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return "N/A";
  return iso.split("T")[1]?.slice(0, 5) || "N/A";
}

// ─────────────────────────────────────────
//  MAIN: searchFlights()
// ─────────────────────────────────────────
async function searchFlights({
  origin,
  destination,
  date,
  passengers = 1,
  class: cabinClass = "economy",
}) {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;

  if (!apiKey) {
    return {
      error: true,
      message: "AVIATIONSTACK_API_KEY not set in .env",
      suggestion: "Sign up free at https://aviationstack.com and add the key to .env",
    };
  }

  const originCode      = resolveIATA(origin);
  const destinationCode = resolveIATA(destination);

  console.log(`\n  [flights.js] Searching ${originCode} → ${destinationCode} on ${date}\n`);

  try {
    const res = await axios.get(`${BASE_URL}/flights`, {
      params: {
        access_key:   apiKey,
        dep_iata:     originCode,
        arr_iata:     destinationCode,
        flight_date:  date,
        limit:        5,
      },
    });

    // Handle API-level errors
    if (res.data.error) {
      return {
        error: true,
        code:    res.data.error.code,
        message: res.data.error.message,
        suggestion: "Check your API key and ensure the date is valid (YYYY-MM-DD)",
      };
    }

    const rawFlights = res.data.data || [];

    if (rawFlights.length === 0) {
      // Aviationstack free tier may return empty for future dates
      // Fall back to realistic mock so agent still works during dev
      console.log("  [flights.js] No live results — using dev fallback data\n");
      return getMockFlights(originCode, destinationCode, date);
    }

    // Transform to clean format
    const flights = rawFlights.map((f, i) => ({
      flightId:    f.flight?.iata || `FL-${i + 1}`,
      airline:     f.airline?.name || f.airline?.iata || "Unknown",
      flightNo:    f.flight?.iata || "N/A",
      origin:      f.departure?.iata || originCode,
      destination: f.arrival?.iata   || destinationCode,
      date,
      departure:   formatTime(f.departure?.scheduled),
      arrival:     formatTime(f.arrival?.scheduled),
      duration:    calcDuration(f.departure?.scheduled, f.arrival?.scheduled),
      status:      f.flight_status || "scheduled",
      terminal:    f.departure?.terminal || "N/A",
      gate:        f.departure?.gate     || "N/A",
      // Aviationstack free tier doesn't include price
      // Price shown is an estimate — replace with booking API for real prices
      price:       estimatePrice(originCode, destinationCode, cabinClass),
      currency:    "INR",
      class:       cabinClass,
      passengers,
    }));

    return { flights, count: flights.length, origin: originCode, destination: destinationCode };

  } catch (err) {
    const status = err.response?.status;

    if (status === 403) {
      console.log("  [flights.js] Aviationstack 403 (free plan limit) — using dev fallback\n");
      return getMockFlights(originCode, destinationCode, date);
    }

    if (status === 401) {
      return {
        error: true,
        message: "Invalid Aviationstack API key (401)",
        suggestion: "Check AVIATIONSTACK_API_KEY in your .env file",
      };
    }

    console.log("  [flights.js] API error (" + (status || err.message) + ") — using dev fallback\n");
    return getMockFlights(originCode, destinationCode, date);
  }
}

// ─────────────────────────────────────────
//  PRICE ESTIMATOR
//  Aviationstack free plan has no pricing data
//  Use this until you add a booking API
// ─────────────────────────────────────────
function estimatePrice(origin, destination, cabinClass) {
  const baseRoutes = {
    "DEL-GOI": 4200, "GOI-DEL": 4200,
    "DEL-BOM": 4800, "BOM-DEL": 4800,
    "DEL-BLR": 5100, "BLR-DEL": 5100,
    "DEL-MAA": 5500, "MAA-DEL": 5500,
    "BOM-GOI": 3200, "GOI-BOM": 3200,
    "BOM-BLR": 2800, "BLR-BOM": 2800,
    "DEL-HYD": 4600, "HYD-DEL": 4600,
    "DEL-CCU": 4900, "CCU-DEL": 4900,
  };

  const key   = `${origin}-${destination}`;
  const base  = baseRoutes[key] || 5000;
  const multi = { economy: 1, business: 2.8, first: 4.5 };
  const rand  = 0.9 + Math.random() * 0.2; // ±10% variance

  return Math.round(base * (multi[cabinClass] || 1) * rand);
}

// ─────────────────────────────────────────
//  DEV FALLBACK — realistic mock data
//  Used when Aviationstack returns no results
//  (common on free tier for future dates)
// ─────────────────────────────────────────
function getMockFlights(origin, destination, date) {
  return {
    flights: [
      {
        flightId:    "6E-2341",
        airline:     "IndiGo",
        flightNo:    "6E-2341",
        origin, destination, date,
        departure:   "08:30",
        arrival:     "10:45",
        duration:    "2h 15m",
        status:      "scheduled",
        terminal:    "2",
        gate:        "14A",
        price:       estimatePrice(origin, destination, "economy"),
        currency:    "INR",
        class:       "economy",
        note:        "Dev fallback — real data needs paid Aviationstack plan",
      },
      {
        flightId:    "AI-441",
        airline:     "Air India",
        flightNo:    "AI-441",
        origin, destination, date,
        departure:   "11:00",
        arrival:     "13:10",
        duration:    "2h 10m",
        status:      "scheduled",
        terminal:    "3",
        gate:        "22B",
        price:       estimatePrice(origin, destination, "economy") + 700,
        currency:    "INR",
        class:       "economy",
        note:        "Dev fallback — real data needs paid Aviationstack plan",
      },
      {
        flightId:    "SG-901",
        airline:     "SpiceJet",
        flightNo:    "SG-901",
        origin, destination, date,
        departure:   "16:45",
        arrival:     "19:00",
        duration:    "2h 15m",
        status:      "scheduled",
        terminal:    "1",
        gate:        "8C",
        price:       estimatePrice(origin, destination, "economy") - 400,
        currency:    "INR",
        class:       "economy",
        note:        "Dev fallback — real data needs paid Aviationstack plan",
      },
    ],
    count: 3,
    origin,
    destination,
    source: "dev-fallback",
  };
}

// ─────────────────────────────────────────
//  QUICK TEST — run: node flights.js
// ─────────────────────────────────────────
async function test() {
  console.log("Testing Aviationstack...\n");
  const result = await searchFlights({
    origin:      "Delhi",
    destination: "Goa",
    date:        "2026-04-20",
  });

  if (result.error) {
    console.error("Error:", result.message);
    console.log("Fix:", result.suggestion);
  } else {
    console.log(`Source: ${result.source || "live"} | Found: ${result.count} flights\n`);
    result.flights.forEach((f, i) => {
      console.log(`${i + 1}. ${f.flightNo} | ${f.airline}`);
      console.log(`   ${f.departure} → ${f.arrival} (${f.duration})`);
      console.log(`   ₹${f.price} | ${f.class}\n`);
    });
  }
}

if (require.main === module) test();

module.exports = { searchFlights };