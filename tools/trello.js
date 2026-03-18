// ============================================================
//  tools/trello.js — Trello Card Creator
//  Called by agent.js after every confirmed booking
// ============================================================

require("dotenv").config();
const axios = require("axios");

async function createTrelloCard({ title, description = "", dueDate }) {
  console.log(`\n  [trello.js] Creating card: "${title}"\n`);

  const key    = process.env.TRELLO_API_KEY;
  const token  = process.env.TRELLO_TOKEN;
  const listId = process.env.TRELLO_LIST_ID;

  if (!key || !token || !listId) {
    console.log("  [trello.js] Credentials missing — simulating card creation");
    return {
      success: true,
      cardId:  "mock-" + Date.now(),
      url:     "https://trello.com/c/mockcard",
      title,
      note:    "Set TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_LIST_ID in .env for real cards",
    };
  }

  try {
    const res = await axios.post("https://api.trello.com/1/cards", {
      name:   title,
      desc:   description,
      idList: listId,
      due:    dueDate || null,
      key,
      token,
    });

    return {
      success: true,
      cardId:  res.data.id,
      url:     res.data.url,
      title:   res.data.name,
    };
  } catch (err) {
    return {
      success: false,
      error:   err.response?.data || err.message,
    };
  }
}

module.exports = { createTrelloCard };