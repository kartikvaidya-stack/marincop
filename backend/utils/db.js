// backend/utils/db.js
// Uses /marincop/database/data/claims.json as storage (existing project structure)

const fs = require("fs");
const path = require("path");

// IMPORTANT: This matches your existing data location
const DB_PATH = path.join(process.cwd(), "database", "data", "claims.json");

function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(DB_PATH)) {
    const initial = { claims: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
  }
}

function loadDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { claims: [] };
    if (!Array.isArray(data.claims)) data.claims = [];
    return data;
  } catch {
    // If file is corrupted, recover safely (but do NOT delete old file)
    return { claims: [] };
  }
}

function saveDb(db) {
  ensureDbFile();
  const safe = db && typeof db === "object" ? db : { claims: [] };
  if (!Array.isArray(safe.claims)) safe.claims = [];
  fs.writeFileSync(DB_PATH, JSON.stringify(safe, null, 2), "utf-8");
}

module.exports = { loadDb, saveDb, DB_PATH };
