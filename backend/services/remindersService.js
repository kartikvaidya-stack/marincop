// backend/services/remindersService.js
const fs = require("fs");
const path = require("path");

/**
 * Uses the same JSON file as claimService (database/data/claims.json).
 * Uses __dirname to ensure consistent path resolution regardless of where the process is started.
 */
const CLAIMS_PATH = path.join(__dirname, "../../database/data/claims.json");

function readClaims() {
  try {
    if (!fs.existsSync(CLAIMS_PATH)) return [];
    const raw = fs.readFileSync(CLAIMS_PATH, "utf-8");
    if (!raw || !raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    // If file is corrupted / invalid, fail safe to empty array
    return [];
  }
}

function toISO(d) {
  try {
    return new Date(d).toISOString();
  } catch {
    return null;
  }
}

function normalizeReminderItem({ claim, action }) {
  return {
    claimId: claim.id,
    claimNumber: claim.claimNumber,
    vesselName: claim.vesselName || claim?.extraction?.vesselName || null,
    progressStatus: claim.progressStatus || "Unknown",
    coverTypes: Array.isArray(claim.covers) ? claim.covers : [],
    actionId: action.id,
    actionTitle: action.title,
    ownerRole: action.ownerRole || null,
    reminderAt: action.reminderAt || null,
    dueAt: action.dueAt || null,
  };
}

/**
 * Get ALL reminders (both overdue and upcoming).
 * Query params (optional):
 * - daysAhead: number (default 30) -> upcoming window
 * - includeDone: "true"|"false" (default false)
 */
function getReminders({ daysAhead = 30, includeDone = false } = {}) {
  const claims = readClaims();

  const now = new Date();
  const nowMs = now.getTime();
  const windowMs = Number(daysAhead) * 24 * 60 * 60 * 1000;
  const upperMs = nowMs + windowMs;

  const items = [];

  for (const claim of claims) {
    const actions = Array.isArray(claim.actions) ? claim.actions : [];
    for (const action of actions) {
      if (!action || !action.reminderAt) continue;
      if (!includeDone && String(action.status || "").toUpperCase() === "DONE") continue;

      const rMs = new Date(action.reminderAt).getTime();
      if (Number.isNaN(rMs)) continue;

      // include overdue OR within upcoming window
      if (rMs <= upperMs) {
        items.push(normalizeReminderItem({ claim, action }));
      }
    }
  }

  // Sort: overdue first, then nearest upcoming
  items.sort((a, b) => {
    const am = new Date(a.reminderAt).getTime();
    const bm = new Date(b.reminderAt).getTime();
    return am - bm;
  });

  return items;
}

/**
 * Get reminders that are due/overdue OR upcoming (within 30 days).
 * This includes both past reminders (overdue) and future reminders (upcoming).
 */
function getDueReminders() {
  const claims = readClaims();
  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const futureMs = nowMs + thirtyDaysMs;

  const items = [];

  for (const claim of claims) {
    const actions = Array.isArray(claim.actions) ? claim.actions : [];
    for (const action of actions) {
      if (!action || !action.reminderAt) continue;

      const status = String(action.status || "").toUpperCase();
      if (status === "DONE") continue;

      const rMs = new Date(action.reminderAt).getTime();
      if (Number.isNaN(rMs)) continue;

      // Include reminders that are overdue OR within next 30 days
      if (rMs <= futureMs) {
        items.push(normalizeReminderItem({ claim, action }));
      }
    }
  }

  items.sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime());
  return items;
}

module.exports = {
  getReminders,
  getDueReminders,
};
