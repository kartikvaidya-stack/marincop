// backend/utils/db.js
const fs = require("fs");
const path = require("path");

// Where we store data
const DATA_DIR = path.join(process.cwd(), "database", "data");
const CLAIMS_FILE = path.join(DATA_DIR, "claims.json");

// Ensure folders/files exist
function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CLAIMS_FILE)) fs.writeFileSync(CLAIMS_FILE, JSON.stringify([], null, 2));
}

// Read claims array
function loadDB() {
  ensureFiles();
  const raw = fs.readFileSync(CLAIMS_FILE, "utf-8");
  let claims = [];
  try {
    claims = JSON.parse(raw);
    if (!Array.isArray(claims)) claims = [];
  } catch {
    claims = [];
  }
  return { claims };
}

// Write claims array
function saveDB(db) {
  ensureFiles();
  const claims = Array.isArray(db?.claims) ? db.claims : [];
  fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claims, null, 2));
}

// Make sure db has correct shape
function ensureDBShape(db) {
  if (!db || typeof db !== "object") return { claims: [] };
  if (!Array.isArray(db.claims)) db.claims = [];
  return db;
}

// Claim numbering helper
function nextClaimSequenceForYear(db, year) {
  const claims = Array.isArray(db?.claims) ? db.claims : [];
  const prefix = `MC-NOVA-${year}-`;

  let maxSeq = 0;
  for (const c of claims) {
    const num = c?.claimNumber || "";
    if (!num.startsWith(prefix)) continue;
    const tail = num.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
  }
  return maxSeq + 1;
}

module.exports = {
  loadDB,
  saveDB,
  ensureDBShape,
  nextClaimSequenceForYear,
};
