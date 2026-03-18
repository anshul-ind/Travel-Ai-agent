// ============================================================
//  tools/travel.js — bookFlight() Tool
//  Step 3 of Phase 1
//
//  This file handles flight booking logic.
//  Currently mock — replace with real booking API later.
//  Called by agent.js when Claude triggers bookFlight tool.
// ============================================================

require("dotenv").config();

// ─────────────────────────────────────────
//  bookFlight()
//  Takes flightId + passenger details
//  Returns PNR confirmation
// ─────────────────────────────────────────
async function bookFlight({
  flightId,
  passengerName,
  passengerEmail,
  passengerPhone = "",
  seatPreference = "no_preference",
}) {
  console.log(`\n  [travel.js] bookFlight(${flightId}, ${passengerName})\n`);

  // Validate required fields
  if (!flightId)       return { success: false, error: "flightId is required" };
  if (!passengerName)  return { success: false, error: "passengerName is required" };
  if (!passengerEmail) return { success: false, error: "passengerEmail is required" };

  // Simulate booking API delay
  await new Promise((r) => setTimeout(r, 500));

  // Generate a mock PNR (booking reference)
  const pnr = "BK" + Math.random().toString(36).slice(2, 8).toUpperCase();

  // Assign a seat based on preference
  const seatMap = {
    window:        "12A",
    aisle:         "12C",
    middle:        "12B",
    no_preference: "14D",
  };

  return {
    success:      true,
    pnr,
    flightId,
    passengerName,
    passengerEmail,
    passengerPhone,
    seatAssigned:  seatMap[seatPreference] || "14D",
    status:        "confirmed",
    bookedAt:      new Date().toISOString(),
    message:       `Booking confirmed! Your PNR is ${pnr}`,
  };
}

// ─────────────────────────────────────────
//  QUICK TEST — Step 4
//  Run: node tools/travel.js
// ─────────────────────────────────────────
async function test() {
  console.log("Testing bookFlight...\n");

  const result = await bookFlight({
    flightId:       "6E-2341",
    passengerName:  "Anshul Chouhan",
    passengerEmail: "anshul@example.com",
    passengerPhone: "+91 9876543210",
    seatPreference: "window",
  });

  if (result.success) {
    console.log("Booking confirmed!");
    console.log(`  PNR:          ${result.pnr}`);
    console.log(`  Flight:       ${result.flightId}`);
    console.log(`  Passenger:    ${result.passengerName}`);
    console.log(`  Email:        ${result.passengerEmail}`);
    console.log(`  Seat:         ${result.seatAssigned}`);
    console.log(`  Status:       ${result.status}`);
    console.log(`  Booked at:    ${result.bookedAt}`);
  } else {
    console.error("Booking failed:", result.error);
  }
}

if (require.main === module) test();

module.exports = { bookFlight };