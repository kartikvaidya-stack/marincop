// backend/services/remindersService.js
const fs = require("fs");
const path = require("path");

function claimsFilePath() {
  // This matches your repo structure: /database/data/claims.json
  return path.join(process.cwd(), "database", "data", "claims.json");
}

function safeReadClaims() {
  const file = claimsFilePath();
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    // If JSON is corrupted, return empty rather than crash the server
    console.error("remindersService.safeReadClaims error:", e.message);
    return [];
  }
}

function normalizeCoverTypes(claim) {
  if (Array.isArray(claim?.covers)) return claim.covers;
  if (Array.isArray(claim?.classification?.covers))
    return claim.classification.covers.map((c) => c.type).filter(Boolean);
  return [];
}

function getReminders({ days = 30 } = {}) {
  const claims = safeReadClaims();

  const now = new Date();
  const end = new Date(now.getTime() + Number(days) * 24 * 60 * 60 * 1000);

  const rows = [];

  for (const c of claims) {
    const actions = Array.isArray(c?.actions) ? c.actions : [];
    for (const a of actions) {
      if (!a?.reminderAt) continue;

      const rAt = new Date(a.reminderAt);
      if (Number.isNaN(rAt.getTime())) continue;

      const isOverdue = rAt.getTime() <= now.getTime();
      const isUpcoming = rAt.getTime() > now.getTime() && rAt.getTime() <= end.getTime();

      // Include overdue OR upcoming-in-window
      if (!isOverdue && !isUpcoming) continue;

      rows.push({
        claimId: c.id,
        claimNumber: c.claimNumber,
        vesselName: c.vesselName || c.extraction?.vesselName || null,
        progressStatus: c.progressStatus || "—",
        coverTypes: normalizeCoverTypes(c),
        actionId: a.id,
        actionTitle: a.title || "—",
        ownerRole: a.ownerRole || "—",
        reminderAt: a.reminderAt,
        dueAt: a.dueAt || null,
        overdue: isOverdue,
      });
    }
  }

  rows.sort((x, y) => new Date(x.reminderAt).getTime() - new Date(y.reminderAt).getTime());

  return rows;
}

module.exports = { getReminders };
