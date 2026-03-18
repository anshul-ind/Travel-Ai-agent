// ============================================================
//  AI Travel Agent — Main Brain (Groq Version)
//  Run: node agent.js
//  Free: https://console.groq.com
// ============================================================

require("dotenv").config();
const Groq     = require("groq-sdk");
const readline = require("readline");

// ── Import all tools from their own files ────────────────────
const { searchFlights }    = require("./flights");         // Aviationstack
const { bookFlight }       = require("./tools/travel");    // tools/travel.js
const { createTrelloCard } = require("./tools/trello");    // tools/trello.js
const { checkWeather }     = require("./tools/weather");   // Open-Meteo (free)

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─────────────────────────────────────────
//  TOOL DEFINITIONS  (Groq reads these)
//  Groq uses "parameters" not "input_schema"
// ─────────────────────────────────────────
const tools = [
  {
    type: "function",
    function: {
      name: "searchFlights",
      description:
        "Search for available flights between two cities on a given date. " +
        "Returns a list of options with airline, price, departure time, and flightId.",
      parameters: {
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
          },
          class: {
            type: "string",
            enum: ["economy", "business", "first"],
            description: "Seat class preference (default: economy)",
          },
        },
        required: ["origin", "destination", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bookFlight",
      description:
        "Book a specific flight for a passenger. " +
        "IMPORTANT: Only call this after the user has explicitly confirmed with yes/confirm.",
      parameters: {
        type: "object",
        properties: {
          flightId: {
            type: "string",
            description: "The flight ID returned from searchFlights",
          },
          passengerName: {
            type: "string",
            description: "Full name of the passenger as on government ID",
          },
          passengerEmail: {
            type: "string",
            description: "Email address for booking confirmation",
          },
          passengerPhone: {
            type: "string",
            description: "Contact phone number with country code",
          },
          seatPreference: {
            type: "string",
            enum: ["window", "aisle", "middle", "no_preference"],
            description: "Preferred seat position",
          },
        },
        required: ["flightId", "passengerName", "passengerEmail"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createTrelloCard",
      description:
        "Create a Trello card to log a confirmed booking. " +
        "Always call this immediately after bookFlight succeeds.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Card title e.g. 'Flight: Delhi→Goa | IndiGo | ₹4500 | Apr 20'",
          },
          description: {
            type: "string",
            description: "Full booking details: PNR, passenger, airline, time, price",
          },
          dueDate: {
            type: "string",
            description: "Travel date in YYYY-MM-DD format",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkWeather",
      description:
        "Check weather forecast for a destination city on a given date. " +
        "Call this when user asks about weather, or automatically before booking " +
        "to give travel advice. Uses free Open-Meteo API — no key needed.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "Destination city name (e.g. 'Goa', 'Delhi', 'Mumbai')",
          },
          date: {
            type: "string",
            description: "Date to check weather for in YYYY-MM-DD format",
          },
        },
        required: ["city"],
      },
    },
  },
];

// ─────────────────────────────────────────
//  TOOL ROUTER — maps name → file
// ─────────────────────────────────────────
async function executeTool(name, args) {
  switch (name) {
    case "searchFlights":    return await searchFlights(args);    // → flights.js
    case "bookFlight":       return await bookFlight(args);       // → tools/travel.js
    case "createTrelloCard": return await createTrelloCard(args); // → tools/trello.js
    case "checkWeather":     return await checkWeather(args);     // → tools/weather.js
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─────────────────────────────────────────
//  READLINE
// ─────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function askUser(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

// ─────────────────────────────────────────
//  SYSTEM PROMPT
// ─────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful AI travel booking assistant.

Rules:
1. Call searchFlights first when a user wants to travel
2. Call checkWeather alongside or just after searchFlights to give weather context
3. Present flights AND weather together — e.g. "IndiGo ₹4747 | Weather: 29°C Sunny"
4. ALWAYS ask for explicit user confirmation before calling bookFlight
5. After successful booking, immediately call createTrelloCard
6. Be concise and friendly

Trello card title format:
"Flight: [Origin] → [Destination] | [Airline] | ₹[Price] | [Date]"`;

// ─────────────────────────────────────────
//  MAIN AGENT LOOP
// ─────────────────────────────────────────
async function runAgent() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   AI Travel Agent  (Groq) — Ready      ║");
  console.log("╚════════════════════════════════════════╝");
  console.log('\nTry: "Book a flight from Delhi to Goa on April 20"\n');

  const conversationHistory = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  while (true) {
    // ── Get user input ──────────────────────
    const userInput = await askUser("You: ");
    if (!userInput.trim()) continue;
    if (["exit", "quit", "bye"].includes(userInput.toLowerCase())) {
      console.log("\nAgent: Safe travels! Goodbye.\n");
      rl.close();
      break;
    }

    conversationHistory.push({ role: "user", content: userInput });

    // ── Agentic loop ────────────────────────
    let continueLoop = true;

    while (continueLoop) {
      const response = await client.chat.completions.create({
        model:       "llama-3.3-70b-versatile",
        messages:    conversationHistory,
        tools,
        tool_choice: "auto",
        max_tokens:  1024,
      });

      const message      = response.choices[0].message;
      const finishReason = response.choices[0].finish_reason;

      // Add assistant message to history
      conversationHistory.push(message);

      if (finishReason === "stop" || !message.tool_calls) {
        // Groq is done — print the reply
        if (message.content) {
          console.log(`\nAgent: ${message.content}\n`);
        }
        continueLoop = false;

      } else if (finishReason === "tool_calls" || message.tool_calls?.length > 0) {
        // Groq wants to call tools
        for (const toolCall of message.tool_calls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          console.log(`\n  [Agent → Tool] ${name}`);

          // ── CONFIRMATION GATE ──────────────
          if (name === "bookFlight") {
            console.log("\n  ⚠️  Confirmation required before booking.\n");
            const confirm = await askUser("  Confirm booking? (yes / no): ");

            if (!["yes", "y", "confirm", "ok"].includes(confirm.toLowerCase())) {
              conversationHistory.push({
                role:         "tool",
                tool_call_id: toolCall.id,
                name,
                content: JSON.stringify({
                  cancelled: true,
                  message:   "User cancelled the booking. Ask if they want different options.",
                }),
              });
              continue;
            }
          }

          // Execute the tool
          const result = await executeTool(name, args);

          // Send result back to Groq
          conversationHistory.push({
            role:         "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify(result),
          });
        }
        // Loop continues — Groq processes results and decides next step

      } else {
        continueLoop = false;
      }
    }
  }
}

// ─────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────
runAgent().catch((err) => {
  console.error("\n[Error]", err.message);
  if (err.status === 401) console.error("→ Check GROQ_API_KEY in .env");
  process.exit(1);
});