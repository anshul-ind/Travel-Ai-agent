'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────
interface Flight {
  flightId: string; airline: string; flightNo: string
  origin: string; destination: string; date: string
  departure: string; arrival: string; duration: string
  price: number; currency: string; class: string
}
interface Weather {
  city: string; date: string; condition: string
  tempMax: number; tempMin: number; precipitation: string
}
interface Booking {
  pnr: string; flightId: string; passengerName: string
  passengerEmail: string; seatAssigned: string; status: string; bookedAt: string
}
interface TrelloCard { url: string; title: string; cardId: string }

// ─── Flight Card Component ────────────────────────────────────
function FlightCard({ flight, onSelect }: { flight: Flight; onSelect: (f: Flight) => void }) {
  return (
    <button
      onClick={() => onSelect(flight)}
      className="flight-card w-full text-left bg-[#141414] border border-[#2A2A2A] rounded-lg p-4 hover:border-amber-500/50 transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-body text-[#6B6B6B] tracking-widest uppercase">{flight.flightNo}</span>
          <span className="w-1 h-1 rounded-full bg-[#3A3A3A]" />
          <span className="text-sm font-body text-stone-300">{flight.airline}</span>
        </div>
        <div className="text-right">
          <div className="font-display text-lg text-amber-400 leading-none">
            ₹{flight.price.toLocaleString()}
          </div>
          <div className="text-xs text-[#6B6B6B] font-body capitalize">{flight.class}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="font-display text-xl text-stone-100">{flight.departure}</div>
          <div className="text-xs text-[#6B6B6B] font-body">{flight.origin}</div>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="text-xs text-[#4A4A4A] font-body">{flight.duration}</div>
          <div className="w-full flex items-center gap-1">
            <div className="flex-1 h-px bg-[#2A2A2A]" />
            <div className="w-1.5 h-1.5 rounded-full border border-[#4A4A4A]" />
            <div className="flex-1 h-px bg-[#2A2A2A]" />
          </div>
          <div className="text-xs text-[#4A4A4A] font-body">Direct</div>
        </div>
        <div className="text-center">
          <div className="font-display text-xl text-stone-100">{flight.arrival}</div>
          <div className="text-xs text-[#6B6B6B] font-body">{flight.destination}</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[#1E1E1E] text-xs text-[#4A4A4A] font-body group-hover:text-amber-500/60 transition-colors">
        Click to select this flight →
      </div>
    </button>
  )
}

// ─── Weather Card Component ───────────────────────────────────
function WeatherCard({ weather }: { weather: Weather }) {
  const isGood = !['rain', 'storm', 'snow', 'fog'].some(w =>
    weather.condition.toLowerCase().includes(w)
  )
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-[#6B6B6B] font-body tracking-widest uppercase mb-1">
            {weather.city} · {weather.date}
          </div>
          <div className="font-display text-2xl text-stone-100">
            {weather.tempMin}° – {weather.tempMax}°C
          </div>
          <div className="text-sm text-stone-400 font-body mt-0.5">{weather.condition}</div>
        </div>
        <div className={`text-xs px-2 py-1 rounded font-body ${isGood ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-amber-950 text-amber-400 border border-amber-900'}`}>
          {isGood ? 'Good to fly' : 'Check before flying'}
        </div>
      </div>
      {weather.precipitation !== '0.0mm' && (
        <div className="mt-2 text-xs text-[#6B6B6B] font-body">
          Precipitation: {weather.precipitation}
        </div>
      )}
    </div>
  )
}

// ─── Booking Card Component ───────────────────────────────────
function BookingCard({ booking, trello }: { booking: Booking; trello?: TrelloCard }) {
  return (
    <div className="bg-[#0F0F0F] border border-amber-500/20 rounded-lg overflow-hidden">
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="text-xs font-body text-amber-400 tracking-widest uppercase">Booking Confirmed</span>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {[
          ['PNR', booking.pnr],
          ['Flight', booking.flightId],
          ['Passenger', booking.passengerName],
          ['Seat', booking.seatAssigned],
          ['Email', booking.passengerEmail],
          ['Status', booking.status],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-xs text-[#6B6B6B] font-body uppercase tracking-wider mb-0.5">{label}</div>
            <div className="text-sm text-stone-200 font-body capitalize">{value}</div>
          </div>
        ))}
      </div>
      {trello?.url && (
        <div className="border-t border-[#1E1E1E] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">T</span>
            </div>
            <span className="text-xs text-[#6B6B6B] font-body">Saved to Trello</span>
          </div>
          <a
            href={trello.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 font-body transition-colors"
          >
            View card →
          </a>
        </div>
      )}
    </div>
  )
}

// ─── Typing Indicator ─────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="dot w-1.5 h-1.5 rounded-full bg-amber-400/60" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  )
}

// ─── Parse tool results from message ─────────────────────────
function extractToolData(message: any) {
  const flights: Flight[]     = []
  const weathers: Weather[]   = []
  let booking: Booking | null = null
  let trello: TrelloCard | null = null

  if (message.toolInvocations) {
    for (const tool of message.toolInvocations) {
      if (tool.state !== 'result') continue
      const r = tool.result
      if (r?.type === 'flights')  flights.push(...(r.flights || []))
      if (r?.type === 'weather')  weathers.push(r)
      if (r?.type === 'booking')  booking = r
      if (r?.type === 'trello')   trello  = r
    }
  }
  return { flights, weathers, booking, trello }
}

// ─── Suggestions ──────────────────────────────────────────────
const SUGGESTIONS = [
  "Book a flight from Delhi to Goa on April 20",
  "Find flights to Mumbai next week",
  "What's the weather in Goa this weekend?",
  "Book Delhi to Bangalore on May 5, economy",
]

// ─── Main Page ────────────────────────────────────────────────
export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: '/api/chat',
  })

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const [selectedFlights, setSelectedFlights] = useState<Record<string, Flight>>({})

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Handle flight selection — pre-fill booking prompt
  function handleFlightSelect(flight: Flight, msgId: string) {
    setSelectedFlights(prev => ({ ...prev, [msgId]: flight }))
    setInput(`Book the ${flight.airline} flight (${flight.flightNo}) at ₹${flight.price.toLocaleString()}. My name is [Your Name], email [your@email.com]`)
    inputRef.current?.focus()
  }

  function handleSuggestion(text: string) {
    setInput(text)
    inputRef.current?.focus()
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto relative z-10">

      {/* Header */}
      <header className="flex-shrink-0 px-6 pt-8 pb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-3xl font-light tracking-wide text-stone-100">
            Voyage
          </h1>
          <span className="text-xs font-body text-[#4A4A4A] tracking-widest uppercase">
            AI Travel
          </span>
        </div>
        <div className="gold-line mt-4" />
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-6">

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-8 pb-8">
            <div className="text-center">
              <div className="font-display text-5xl font-light text-stone-800 mb-2">Where to?</div>
              <p className="font-body text-sm text-[#4A4A4A]">
                Tell me your destination and I'll handle the rest.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="text-left text-sm font-body text-[#6B6B6B] hover:text-stone-300 border border-[#1E1E1E] hover:border-[#3A3A3A] rounded-lg px-4 py-3 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => {
          const { flights, weathers, booking, trello } = extractToolData(msg)
          const isUser = msg.role === 'user'

          return (
            <div key={msg.id} className="msg-enter space-y-3">

              {/* Message bubble */}
              {msg.content && (
                <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-6 h-6 rounded-full border border-amber-500/30 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    </div>
                  )}
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl font-body text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-[#1E1E1E] text-stone-200 rounded-br-sm'
                      : 'bg-transparent text-stone-300 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              )}

              {/* Flight cards */}
              {flights.length > 0 && (
                <div className="space-y-2 pl-8">
                  <div className="text-xs text-[#4A4A4A] font-body tracking-widest uppercase mb-2">
                    Available flights
                  </div>
                  {flights.map((f) => (
                    <FlightCard
                      key={f.flightId}
                      flight={f}
                      onSelect={(flight) => handleFlightSelect(flight, msg.id)}
                    />
                  ))}
                </div>
              )}

              {/* Weather cards */}
              {weathers.length > 0 && (
                <div className="space-y-2 pl-8">
                  {weathers.map((w, i) => (
                    <WeatherCard key={i} weather={w} />
                  ))}
                </div>
              )}

              {/* Booking confirmation */}
              {booking && (
                <div className="pl-8">
                  <BookingCard booking={booking} trello={trello || undefined} />
                </div>
              )}
            </div>
          )
        })}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-start">
            <div className="w-6 h-6 rounded-full border border-amber-500/30 flex items-center justify-center mr-2 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <div className="bg-[#141414] rounded-2xl rounded-bl-sm">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-6 pb-8">
        <div className="gold-line mb-4" />
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e as any)
              }
            }}
            placeholder="Where would you like to go?"
            rows={1}
            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 pr-12 text-sm font-body text-stone-200 placeholder-[#3A3A3A] focus:border-[#3A3A3A] transition-colors resize-none"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-[#2A2A2A] disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        <div className="mt-2 text-center text-xs text-[#2A2A2A] font-body">
          Powered by Groq · Llama 3.3 70B
        </div>
      </div>
    </div>
  )
}
