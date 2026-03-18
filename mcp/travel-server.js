// ============================================================
//  mcp/travel-server.js — MCP Travel Server
//  Phase 4: Proper MCP Architecture
//
//  Exposes your travel tools as a real MCP server that
//  Claude Code, Cursor, or any MCP client can connect to.
//
//  Run standalone:  node mcp/travel-server.js
//  Or via config:   see mcp-config.json
//
//  npm install @modelcontextprotocol/sdk
// ============================================================

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { Server }   = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

// ── Import your existing tool implementations ────────────────
const { searchFlights } = require("../flights");
const { bookFlight }    = require("../tools/travel");

// ─────────────────────────────────────────
//  IN-MEMORY BOOKINGS STORE
//  Stores confirmed bookings for URI resources
// ─────────────────────────────────────────
const bookingsStore = [];
const preferencesStore = {
  default: {
    preferredAirline: "IndiGo",
    seatPreference:   "window",
    class:            "economy",
    currency:         "INR",
  },
};

// ─────────────────────────────────────────
//  CREATE MCP SERVER
// ─────────────────────────────────────────
const server = new Server(
  {
    name:    "travel-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools:     {},
      resources: {},
    },
  }
);

// ─────────────────────────────────────────
//  LIST TOOLS
//  Claude Code / Cursor calls this first
//  to discover what tools are available
// ─────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "searchFlights",
        description:
          "Search for available flights between two cities on a given date. " +
          "Returns a list of options with airline, price, departure time, and flightId.",
        inputSchema: {
          type: "object",
          properties: {
            origin: {
              type: "string",
              description: "Departure city or IATA code (e.g. 'Delhi' or 'DEL')",
            },
            destination: {
              type: "string",
              description: "Arrival city or IATA code (e.g. 'Goa' or 'GOI')",
            },
            date: {
              type: "string",
              description: "Travel date in YYYY-MM-DD format",
            },
            passengers: {
              type: "integer",
              description: "Number of passengers (default: 1)",
              default: 1,
            },
            class: {
              type: "string",
              enum: ["economy", "business", "first"],
              description: "Seat class preference",
              default: "economy",
            },
          },
          required: ["origin", "destination", "date"],
        },
      },
      {
        name: "bookFlight",
        description:
          "Book a specific flight for a passenger. " +
          "IMPORTANT: Only call after explicit user confirmation.",
        inputSchema: {
          type: "object",
          properties: {
            flightId: {
              type: "string",
              description: "Flight ID from searchFlights result",
            },
            passengerName: {
              type: "string",
              description: "Full name as on government ID",
            },
            passengerEmail: {
              type: "string",
              description: "Email for booking confirmation",
            },
            passengerPhone: {
              type: "string",
              description: "Phone with country code",
            },
            seatPreference: {
              type: "string",
              enum: ["window", "aisle", "middle", "no_preference"],
              default: "no_preference",
            },
          },
          required: ["flightId", "passengerName", "passengerEmail"],
        },
      },
    ],
  };
});

// ─────────────────────────────────────────
//  CALL TOOL
//  Executes when Claude Code triggers a tool
// ─────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ── searchFlights ──────────────────────
    if (name === "searchFlights") {
      console.error(`[MCP] searchFlights(${args.origin} → ${args.destination}, ${args.date})`);

      const result = await searchFlights(args);

      if (result.error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${result.message}\nSuggestion: ${result.suggestion}`,
          }],
          isError: true,
        };
      }

      // Format flights as readable text for the AI
      const flightList = result.flights.map((f, i) =>
        `${i + 1}. ${f.airline} (${f.flightNo})\n` +
        `   Departure: ${f.departure} → Arrival: ${f.arrival} (${f.duration})\n` +
        `   Price: ₹${f.price} | Class: ${f.class} | Stops: ${f.stops ?? 0}\n` +
        `   Flight ID: ${f.flightId}`
      ).join("\n\n");

      return {
        content: [{
          type: "text",
          text: `Found ${result.count} flights from ${result.origin} to ${result.destination}:\n\n${flightList}`,
        }],
      };
    }

    // ── bookFlight ─────────────────────────
    if (name === "bookFlight") {
      console.error(`[MCP] bookFlight(${args.flightId}, ${args.passengerName})`);

      const result = await bookFlight(args);

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `Booking failed: ${result.error}`,
          }],
          isError: true,
        };
      }

      // Save to bookings store for URI resource access
      bookingsStore.push({
        ...result,
        flightId:      args.flightId,
        bookedAt:      new Date().toISOString(),
      });

      return {
        content: [{
          type: "text",
          text: [
            `Booking confirmed!`,
            `PNR:       ${result.pnr}`,
            `Passenger: ${result.passengerName}`,
            `Email:     ${result.passengerEmail}`,
            `Flight:    ${result.flightId}`,
            `Seat:      ${result.seatAssigned}`,
            `Status:    ${result.status}`,
            `Booked at: ${result.bookedAt}`,
          ].join("\n"),
        }],
      };
    }

    // ── Unknown tool ───────────────────────
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };

  } catch (err) {
    console.error(`[MCP] Tool error in ${name}:`, err.message);
    return {
      content: [{ type: "text", text: `Tool execution error: ${err.message}` }],
      isError: true,
    };
  }
});

// ─────────────────────────────────────────
//  LIST RESOURCES
//  AI clients call this to discover
//  what data URIs are available
// ─────────────────────────────────────────
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // Build dynamic booking resources from store
  const bookingResources = bookingsStore.map((b) => ({
    uri:         `travel://bookings/${b.pnr}`,
    name:        `Booking ${b.pnr}`,
    description: `Flight booking for ${b.passengerName}`,
    mimeType:    "application/json",
  }));

  return {
    resources: [
      // Static route resources
      {
        uri:         "travel://flights/Delhi/Goa",
        name:        "Delhi → Goa flights",
        description: "Available flights from Delhi to Goa",
        mimeType:    "application/json",
      },
      {
        uri:         "travel://flights/Delhi/Mumbai",
        name:        "Delhi → Mumbai flights",
        description: "Available flights from Delhi to Mumbai",
        mimeType:    "application/json",
      },
      {
        uri:         "travel://flights/Mumbai/Bangalore",
        name:        "Mumbai → Bangalore flights",
        description: "Available flights from Mumbai to Bangalore",
        mimeType:    "application/json",
      },
      // Dynamic booking resources
      ...bookingResources,
      // Preferences resource
      {
        uri:         "travel://preferences/default",
        name:        "Default travel preferences",
        description: "Saved travel preferences — airline, seat, class",
        mimeType:    "application/json",
      },
    ],
  };
});

// ─────────────────────────────────────────
//  READ RESOURCE
//  AI client reads data from a URI
//  e.g. travel://flights/Delhi/Goa
// ─────────────────────────────────────────
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  console.error(`[MCP] Reading resource: ${uri}`);

  // ── travel://flights/{origin}/{destination} ──
  const flightMatch = uri.match(/^travel:\/\/flights\/([^/]+)\/([^/]+)$/);
  if (flightMatch) {
    const origin      = decodeURIComponent(flightMatch[1]);
    const destination = decodeURIComponent(flightMatch[2]);
    const date        = new Date().toISOString().split("T")[0];

    const result = await searchFlights({ origin, destination, date });

    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  // ── travel://bookings/{pnr} ──────────────
  const bookingMatch = uri.match(/^travel:\/\/bookings\/([^/]+)$/);
  if (bookingMatch) {
    const pnr     = bookingMatch[1];
    const booking = bookingsStore.find((b) => b.pnr === pnr);

    if (!booking) {
      throw new Error(`Booking not found: ${pnr}`);
    }

    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(booking, null, 2),
      }],
    };
  }

  // ── travel://preferences/{userId} ────────
  const prefMatch = uri.match(/^travel:\/\/preferences\/([^/]+)$/);
  if (prefMatch) {
    const userId = prefMatch[1];
    const prefs  = preferencesStore[userId] || preferencesStore.default;

    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(prefs, null, 2),
      }],
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
});

// ─────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] Travel server running on stdio");
  console.error("[MCP] Tools: searchFlights, bookFlight");
  console.error("[MCP] Resources: travel://flights/*, travel://bookings/*, travel://preferences/*");
}

main().catch((err) => {
  console.error("[MCP] Fatal error:", err);
  process.exit(1);
});