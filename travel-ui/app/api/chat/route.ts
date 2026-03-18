import { createGroq } from '@ai-sdk/groq'
import { streamText, tool } from 'ai'
import { z } from 'zod'

// ── Tool implementations (copied from your agent project) ────
// In production, import these from a shared package
// For now they're inline to keep the UI self-contained

const CITY_TO_IATA: Record<string, string> = {
  'delhi': 'DEL', 'new delhi': 'DEL', 'mumbai': 'BOM', 'bombay': 'BOM',
  'bangalore': 'BLR', 'bengaluru': 'BLR', 'goa': 'GOI', 'hyderabad': 'HYD',
  'chennai': 'MAA', 'kolkata': 'CCU', 'pune': 'PNQ', 'ahmedabad': 'AMD',
  'jaipur': 'JAI', 'lucknow': 'LKO', 'kochi': 'COK', 'bhopal': 'BHO',
  'dubai': 'DXB', 'london': 'LHR', 'singapore': 'SIN', 'bangkok': 'BKK',
}

const CITY_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  'goa':       { lat: 15.2993, lon: 74.1240, name: 'Goa' },
  'delhi':     { lat: 28.6139, lon: 77.2090, name: 'Delhi' },
  'mumbai':    { lat: 19.0760, lon: 72.8777, name: 'Mumbai' },
  'bangalore': { lat: 12.9716, lon: 77.5946, name: 'Bangalore' },
  'hyderabad': { lat: 17.3850, lon: 78.4867, name: 'Hyderabad' },
  'chennai':   { lat: 13.0827, lon: 80.2707, name: 'Chennai' },
  'kolkata':   { lat: 22.5726, lon: 88.3639, name: 'Kolkata' },
  'jaipur':    { lat: 26.9124, lon: 75.7873, name: 'Jaipur' },
  'dubai':     { lat: 25.2048, lon: 55.2708, name: 'Dubai' },
  'london':    { lat: 51.5074, lon: -0.1278, name: 'London' },
}

function resolveIATA(city: string): string {
  const trimmed = city.trim()
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase()
  return CITY_TO_IATA[trimmed.toLowerCase()] || trimmed.toUpperCase()
}

function estimatePrice(origin: string, destination: string, cabinClass: string): number {
  const routes: Record<string, number> = {
    'DEL-GOI': 4200, 'DEL-BOM': 4800, 'DEL-BLR': 5100,
    'BOM-GOI': 3200, 'BOM-BLR': 2800, 'DEL-HYD': 4600,
  }
  const key = `${origin}-${destination}`
  const base = routes[key] || 5000
  const multi: Record<string, number> = { economy: 1, business: 2.8, first: 4.5 }
  return Math.round(base * (multi[cabinClass] || 1) * (0.9 + Math.random() * 0.2))
}

const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  80: 'Rain showers', 95: 'Thunderstorm',
}

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = await streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: `You are Voyage, a luxury AI travel booking assistant.

Rules:
1. Call searchFlights when user wants to travel
2. Call checkWeather alongside flights for travel context  
3. Present results clearly — airline, price, times, weather
4. ALWAYS confirm before bookFlight: "Shall I confirm this booking?"
5. Call createTrelloCard immediately after successful bookFlight
6. Be elegant, concise, helpful

When showing flights, format like:
"Here are flights from [X] to [Y]:
**1. IndiGo 6E-2341** — ₹4,747 | 08:30 → 10:45 | Flight ID: 6E-2341
**2. Air India AI-441** — ₹5,447 | 11:00 → 13:10 | Flight ID: AI-441"

After booking, always mention the Trello card was created.`,

    messages,
    maxSteps: 10,

    tools: {
      searchFlights: tool({
        description: 'Search available flights between two cities',
        parameters: z.object({
          origin:      z.string().describe('Departure city or IATA code'),
          destination: z.string().describe('Arrival city or IATA code'),
          date:        z.string().describe('Travel date YYYY-MM-DD'),
          class:       z.enum(['economy', 'business', 'first']).default('economy'),
        }),
        execute: async ({ origin, destination, date, class: cabinClass = 'economy' }) => {
          const o = resolveIATA(origin)
          const d = resolveIATA(destination)
          // Return structured data — UI renders as flight cards
          return {
            type: 'flights',
            flights: [
              { flightId: '6E-2341', airline: 'IndiGo',   flightNo: '6E-2341', origin: o, destination: d, date, departure: '08:30', arrival: '10:45', duration: '2h 15m', price: estimatePrice(o, d, cabinClass), currency: 'INR', class: cabinClass },
              { flightId: 'AI-441',  airline: 'Air India', flightNo: 'AI-441',  origin: o, destination: d, date, departure: '11:00', arrival: '13:10', duration: '2h 10m', price: estimatePrice(o, d, cabinClass) + 700, currency: 'INR', class: cabinClass },
              { flightId: 'SG-901',  airline: 'SpiceJet',  flightNo: 'SG-901',  origin: o, destination: d, date, departure: '16:45', arrival: '19:00', duration: '2h 15m', price: estimatePrice(o, d, cabinClass) - 400, currency: 'INR', class: cabinClass },
            ],
          }
        },
      }),

      checkWeather: tool({
        description: 'Check weather forecast for a destination city',
        parameters: z.object({
          city: z.string().describe('City name'),
          date: z.string().optional().describe('Date YYYY-MM-DD'),
        }),
        execute: async ({ city, date }) => {
          const coords = CITY_COORDS[city.toLowerCase().trim()]
          if (!coords) return { error: `Unknown city: ${city}` }
          const targetDate = date || new Date().toISOString().split('T')[0]
          try {
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&timezone=Asia/Kolkata&start_date=${targetDate}&end_date=${targetDate}`
            )
            const data = await res.json()
            const idx  = data.daily.time.indexOf(targetDate)
            if (idx === -1) return { error: 'Date out of forecast range (max 16 days ahead)' }
            const code   = data.daily.weathercode[idx]
            const tMax   = Math.round(data.daily.temperature_2m_max[idx])
            const tMin   = Math.round(data.daily.temperature_2m_min[idx])
            const rain   = (data.daily.precipitation_sum[idx] || 0).toFixed(1)
            const cond   = WMO[code] || 'Unknown'
            return { type: 'weather', city: coords.name, date: targetDate, condition: cond, tempMax: tMax, tempMin: tMin, precipitation: `${rain}mm` }
          } catch {
            return { error: 'Weather fetch failed' }
          }
        },
      }),

      bookFlight: tool({
        description: 'Book a flight after user confirmation',
        parameters: z.object({
          flightId:       z.string(),
          passengerName:  z.string(),
          passengerEmail: z.string(),
          passengerPhone: z.string().optional(),
          seatPreference: z.enum(['window', 'aisle', 'middle', 'no_preference']).default('no_preference'),
        }),
        execute: async ({ flightId, passengerName, passengerEmail, seatPreference }) => {
          const pnr  = 'BK' + Math.random().toString(36).slice(2, 8).toUpperCase()
          const seat = seatPreference === 'window' ? '12A' : seatPreference === 'aisle' ? '12C' : '14D'
          return { type: 'booking', success: true, pnr, flightId, passengerName, passengerEmail, seatAssigned: seat, status: 'confirmed', bookedAt: new Date().toISOString() }
        },
      }),

      createTrelloCard: tool({
        description: 'Create a Trello card to log a confirmed booking',
        parameters: z.object({
          title:       z.string(),
          description: z.string().optional(),
          dueDate:     z.string().optional(),
        }),
        execute: async ({ title, description, dueDate }) => {
          const key    = process.env.TRELLO_API_KEY
          const token  = process.env.TRELLO_TOKEN
          const listId = process.env.TRELLO_LIST_ID
          if (!key || !token || !listId) {
            return { success: true, cardId: 'mock-' + Date.now(), url: 'https://trello.com', title, note: 'Mock — set Trello keys in .env.local' }
          }
          try {
            const res = await fetch('https://api.trello.com/1/cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: title, desc: description || '', idList: listId, due: dueDate || null, key, token }),
            })
            const card = await res.json()
            return { type: 'trello', success: true, cardId: card.id, url: card.url, title: card.name }
          } catch {
            return { success: false, error: 'Trello API failed' }
          }
        },
      }),
    },
  })

  return result.toDataStreamResponse()
}