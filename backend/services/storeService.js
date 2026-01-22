// backend/services/storeService.js
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "database", "data", "claims.json");

function safeParse(jsonText) {
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

async function readDb() {
  const raw = await fs.promises.readFile(DB_PATH, "utf8");
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.claims)) {
    // If file corrupted, fail loudly rather than silently losing data
    throw new Error("Database file is invalid JSON or missing 'claims' array.");
  }
  return parsed;
}

/**
 * Atomic write:
 * write to temp file then rename (prevents partial writes)
 */
async function writeDb(dbObject) {
  const tmpPath = `${DB_PATH}.tmp`;
  const data = JSON.stringify(dbObject, null, 2);
  await fs.promises.writeFile(tmpPath, data, "utf8");
  await fs.promises.rename(tmpPath, DB_PATH);
}

module.exports = {
  readDb,
  writeDb,
  DB_PATH,
};
