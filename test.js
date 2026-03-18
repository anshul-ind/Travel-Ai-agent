require("dotenv").config();
const { searchFlights }    = require("./flights");
const { bookFlight }       = require("./tools/travel");
const { createTrelloCard } = require("./tools/trello");

async function runTest() {
  console.log("=== Phase 2 End-to-End Test ===\n");

  // STEP 1: Search flights
  console.log("1. Searching flights...");
  const search = await searchFlights({
    origin:      "Delhi",
    destination: "Goa",
    date:        "2026-04-20",
  });
  const flight = search.flights[0];
  console.log(`   Found: ${flight.airline} | ₹${flight.price} | ${flight.departure}\n`);

  // STEP 2: Book the first flight
  console.log("2. Booking flight...");
  const booking = await bookFlight({
    flightId:       flight.flightId,
    passengerName:  "Anshul Chouhan",
    passengerEmail: "anshul@example.com",
    passengerPhone: "+91 9876543210",
    seatPreference: "window",
  });
  console.log(`   PNR: ${booking.pnr} | Seat: ${booking.seatAssigned}\n`);

  // STEP 3: Create Trello card
  console.log("3. Creating Trello card...");
  const card = await createTrelloCard({
    title: `Flight: ${flight.origin} → ${flight.destination} | ${flight.airline} | ₹${flight.price} | Apr 20`,
    description: [
      `PNR: ${booking.pnr}`,
      `Passenger: ${booking.passengerName}`,
      `Email: ${booking.passengerEmail}`,
      `Flight: ${flight.flightNo}`,
      `Departure: ${flight.departure} → Arrival: ${flight.arrival}`,
      `Seat: ${booking.seatAssigned}`,
      `Price: ₹${flight.price}`,
      `Booked at: ${booking.bookedAt}`,
    ].join("\n"),
    dueDate: "2026-04-20",
  });

  if (card.success) {
    console.log(`   Card created!`);
    console.log(`   Title: ${card.title}`);
    console.log(`   URL:   ${card.url}`);
    console.log("\n=== ALL 3 STEPS PASSED — Phase 2 Complete! ===");
  } else {
    console.log("   Card failed:", card.error);
  }
}

runTest().catch(console.error);