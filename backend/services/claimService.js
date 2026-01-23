// backend/services/claimService.js
const { v4: uuidv4 } = require("uuid");
const { loadDB, saveDB, ensureDBShape, nextClaimSequenceForYear } = require("../utils/db");

// -------------------------
// 1) SIMPLE EXTRACTION (robust enough for MVP)
// -------------------------
function extractFirstNotification(rawText = "") {
  const text = String(rawText || "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const findByRegex = (re) => {
    for (const l of lines) {
      const m = l.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  };

  // Vessel patterns: "Vessel: MV XXX", "M/V XXX", "MV XXX", "MT XXX"
  let vesselName =
    findByRegex(/^(?:vessel|ship)\s*[:\-]\s*(.+)$/i) ||
    findByRegex(/^(?:m\/v|mv|m\.v\.|mt|m\/t)\s+(.+)$/i);

  // If still missing, try to detect "MV NOVA STAR" anywhere
  if (!vesselName) {
    const m = text.match(/\b(M\/V|MV|M\.V\.|M\/T|MT)\s+([A-Z0-9][A-Z0-9 \-]{2,})/i);
    if (m && m[2]) vesselName = `${m[1].toUpperCase().replace(".", "")} ${m[2].trim()}`.replace(/\s+/g, " ");
  }

  const imo = findByRegex(/^(?:imo)\s*[:\-]\s*(\d{7})/i) || (text.match(/\bIMO[:\s]*([0-9]{7})\b/i)?.[1] || null);

  // Date (very loose; you can improve later)
  const eventDateText =
    findByRegex(/^(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})$/) ||
    findByRegex(/^(?:date)\s*[:\-]\s*(.+)$/i) ||
    (text.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/)?.[1] || null);

  // Location / position
  const locationText =
    findByRegex(/^(?:position|location)\s*[:\-]\s*(.+)$/i) ||
    findByRegex(/^(?:at)\s+(.+)$/i) ||
    null;

  // Keywords
  const lower = text.toLowerCase();
  const incidentKeywords = [];
  const kw = [
    "collision", "contact", "grounding", "fire", "explosion", "flooding",
    "pollution", "spill", "injury", "death", "cargo", "damage", "theft",
    "piracy", "detention", "salvage", "towage", "off-hire", "hire"
  ];
  for (const k of kw) if (lower.includes(k)) incidentKeywords.push(k);

  // Counterparty hint (optional)
  const counterpartyText = null;

  // Summary: keep first 8 lines
  const summary = lines.slice(0, 8).join("\n");

  return {
    rawText: text,
    summary,
    vesselName: vesselName || null,
    imo: imo || null,
    eventDateText: eventDateText || null,
    locationText: locationText || null,
    incidentKeywords,
    counterpartyText,
  };
}

// -------------------------
// 2) CLASSIFICATION (includes Charterers’ Liability)
// -------------------------
function classifyFromExtraction(extraction) {
  const t = (extraction?.rawText || "").toLowerCase();
  const k = new Set(extraction?.incidentKeywords || []);

  const covers = [];

  const add = (type, confidence, reasoning) => {
    covers.push({ type, confidence, reasoning });
  };

  // P&I: third-party liabilities (contact/collision/pollution/injury)
  if (k.has("pollution") || k.has("spill") || k.has("injury") || k.has("death") || k.has("collision") || k.has("contact")) {
    add("P&I", 0.85, "Indicates potential third-party liabilities (contact/collision, injury, pollution, damage to third-party property).");
  }

  // H&M: physical damage to the vessel itself (denting, hull, machinery)
  if (t.includes("denting") || t.includes("shell plating") || t.includes("hull") || t.includes("machinery") || k.has("grounding") || k.has("fire") || t.includes("damage to vessel")) {
    add("H&M", 0.75, "Indicates potential physical damage to the vessel (hull/machinery).");
  }

  // Cargo: damage/loss to cargo
  if (t.includes("cargo") && (t.includes("damage") || t.includes("wet") || t.includes("smoke") || t.includes("fire") || t.includes("loss"))) {
    add("Cargo", 0.70, "Text indicates cargo damage/loss exposure.");
  }

  // Charterers’ Liability: explicitly charterer role + CP / hire / off-hire / instructions
  const chartererSignals =
    t.includes("as charterer") ||
    t.includes("charterer") ||
    t.includes("chartered by") ||
    t.includes("time charter") ||
    t.includes("voyage charter") ||
    t.includes("cp ") ||
    t.includes("charterparty") ||
    t.includes("hire") ||
    t.includes("off-hire") ||
    t.includes("under charter") ||
    t.includes("charterers' instructions") ||
    t.includes("charterers instructions");

  if (chartererSignals) {
    add("Charterers’ Liability", 0.65, "Text indicates Nova is acting as charterer / under charterparty obligations (hire/off-hire/CP instructions).");
  }

  // If nothing detected, default to “To be confirmed”
  if (covers.length === 0) {
    add("To Be Confirmed", 0.30, "Insufficient information in first notification to classify confidently.");
  }

  // De-dupe by type, keep highest confidence
  const best = new Map();
  for (const c of covers) {
    if (!best.has(c.type) || best.get(c.type).confidence < c.confidence) best.set(c.type, c);
  }

  return { covers: Array.from(best.values()).sort((a, b) => b.confidence - a.confidence) };
}

// -------------------------
// 3) DEFAULT ACTIONS
// -------------------------
function buildDefaultActions(claimId, nowIso) {
  const now = new Date(nowIso);
  const addDays = (d) => new Date(now.getTime() + d * 86400000).toISOString();

  const mk = (suffix, title, ownerRole, dueAt) => ({
    id: `${claimId}-${suffix}`,
    title,
    ownerRole,
    dueAt,
    status: "OPEN",
    createdAt: nowIso,
    updatedAt: nowIso,
    reminderAt: null,
    notes: "",
  });

  return [
    mk("A1", "Create claim file and preserve evidence", "Claims", nowIso),
    mk("A2", "Confirm cover(s) and notify relevant insurers/club", "Claims", nowIso),
    mk("A3", "Collect supporting documents (logs, photos, reports)", "Ops", addDays(1)),
    mk("A4", "Appoint / confirm surveyor (if required)", "Claims", addDays(1)),
    mk("A5", "Establish initial reserve (estimate) and deductible impact", "Finance", addDays(2)),
    mk("A6", "Track updates and maintain status log", "Claims", nowIso),
    mk("A7", "Identify third-party involvement and liability exposure", "Claims", addDays(1)),
    mk("A8", "Obtain statements (Master/crew) and incident report", "Ops", addDays(1)),
    mk("A9", "Confirm reporting requirements / next steps with insurers", "Claims", addDays(2)),
  ];
}

// -------------------------
// 4) DRAFT TEMPLATES (templates only, no AI yet)
// -------------------------
function buildDraftTemplates(claim) {
  const claimNumber = claim.claimNumber;
  const vessel = claim.extraction?.vesselName || "Vessel (TBC)";
  const imo = claim.extraction?.imo ? ` (IMO ${claim.extraction.imo})` : "";
  const date = claim.extraction?.eventDateText || "Date (TBC)";
  const loc = claim.extraction?.locationText || "Location (TBC)";
  const raw = claim.extraction?.rawText || "";

  return [
    {
      type: "P&I_NOTIFICATION",
      subject: `[${claimNumber}] - ${vessel} - P&I Notification (Initial)`,
      body:
`Dear P&I Club / Correspondents,

We hereby give initial notification of an incident that may give rise to liabilities and/or costs falling within P&I cover.

Claim Ref: ${claimNumber}
Vessel: ${vessel}${imo}
Date/Time (as advised): ${date}
Location/Position: ${loc}

Initial description (as received):
${raw}

Immediate actions taken / proposed:
- Evidence preservation initiated (photos, statements, log extracts)
- Request guidance on next steps and appointment of surveyor (if required)

Kindly acknowledge receipt and advise recommended course of action.

Best regards,
Nova Carriers
(Claims Team)`
    },
    {
      type: "SURVEYOR_APPOINTMENT",
      subject: `[${claimNumber}] - ${vessel} - Survey Appointment Request`,
      body:
`Dear Sir/Madam,

Nova Carriers requests your attendance / appointment as surveyor in relation to the below incident.

Claim Ref: ${claimNumber}
Vessel: ${vessel}${imo}
Incident date: ${date}
Location: ${loc}

Please confirm:
1) Earliest attendance and ETA
2) Information/documents required prior attendance
3) Expected deliverables and timeline for preliminary and final report

Best regards,
Nova Carriers
(Claims Team)`
    },
    {
      type: "CHASE_REMINDER",
      subject: `[${claimNumber}] - ${vessel} - Follow-up / Chase`,
      body:
`Dear All,

Gentle reminder / follow-up in relation to Claim Ref ${claimNumber} (${vessel}).

Please provide an update and expected timeline for outstanding items.

Best regards,
Nova Carriers
(Claims Team)`
    }
  ];
}

// -------------------------
// 5) CRUD + PATCHES
// -------------------------
function listClaims() {
  const db = ensureDBShape(loadDB());
  return db.claims
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((c) => ({
      id: c.id,
      claimNumber: c.claimNumber,
      vesselName: c.extraction?.vesselName || null,
      eventDateText: c.extraction?.eventDateText || null,
      locationText: c.extraction?.locationText || null,
      progressStatus: c.progressStatus,
      covers: (c.classification?.covers || []).map((x) => x.type),
      reserveEstimated: Number(c.finance?.reserveEstimated || 0),
      paid: Number(c.finance?.paid || 0),
      deductible: Number(c.finance?.deductible || 0),
      recoverable: Number(c.finance?.recoverable || 0),
      outstanding: Number(c.finance?.outstanding || 0),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
}

function getClaim(id) {
  const db = ensureDBShape(loadDB());
  return db.claims.find((c) => c.id === id) || null;
}

function createClaim({ createdBy, firstNotificationText }) {
  const db = ensureDBShape(loadDB());
  const now = new Date().toISOString();

  const extraction = extractFirstNotification(firstNotificationText);
  const classification = classifyFromExtraction(extraction);

  const year = new Date().getFullYear();
  const seq = nextClaimSequenceForYear(db, year);
  const claimNumber = `MC-NOVA-${year}-${String(seq).padStart(4, "0")}`;

  const id = uuidv4();
  const actions = buildDefaultActions(id, now);

  const claim = {
    id,
    claimNumber,
    company: "Nova Carriers",
    createdAt: now,
    updatedAt: now,
    createdBy: createdBy || "Unknown",
    progressStatus: "Notification Received",
    extraction,
    classification,
    actions,
    finance: {
      currency: "USD",
      reserveEstimated: 0,
      paid: 0,
      deductible: 0,
      recoverable: 0,
      outstanding: 0,
      notes: "",
    },
    files: [],
    statusLog: [
      { at: now, by: createdBy || "Unknown", status: "Notification Received", note: "Claim created from first notification." }
    ],
    auditTrail: [
      { at: now, by: createdBy || "Unknown", action: "CLAIM_CREATED", note: "Claim created from first notification." }
    ],
  };

  db.claims.push(claim);
  saveDB(db);
  return claim;
}

function updateProgressStatus(id, { by, progressStatus }) {
  const db = ensureDBShape(loadDB());
  const claim = db.claims.find((c) => c.id === id);
  if (!claim) return null;

  const now = new Date().toISOString();
  claim.progressStatus = progressStatus;
  claim.updatedAt = now;

  claim.statusLog = claim.statusLog || [];
  claim.auditTrail = claim.auditTrail || [];

  claim.statusLog.push({ at: now, by, status: progressStatus, note: "Progress updated" });
  claim.auditTrail.push({ at: now, by, action: "STATUS_UPDATED", note: `Progress set to: ${progressStatus}` });

  saveDB(db);
  return claim;
}

function updateAction(id, actionId, { by, status, notes, reminderAt }) {
  const db = ensureDBShape(loadDB());
  const claim = db.claims.find((c) => c.id === id);
  if (!claim) return null;

  const action = (claim.actions || []).find((a) => a.id === actionId);
  if (!action) return null;

  const now = new Date().toISOString();
  claim.updatedAt = now;

  if (status) action.status = status;
  if (typeof notes === "string") action.notes = notes;
  if (typeof reminderAt !== "undefined") action.reminderAt = reminderAt;

  action.updatedAt = now;

  claim.auditTrail = claim.auditTrail || [];
  claim.auditTrail.push({
    at: now,
    by,
    action: "ACTION_UPDATED",
    note: `Action updated: ${action.title} (status=${action.status})`,
  });

  saveDB(db);
  return action;
}

// ✅ Finance update (Fix #2)
function updateFinance(id, finance, by) {
  const db = ensureDBShape(loadDB());
  const claim = db.claims.find((c) => c.id === id);
  if (!claim) return null;

  const now = new Date().toISOString();
  claim.updatedAt = now;

  claim.finance = claim.finance || {};
  claim.auditTrail = claim.auditTrail || [];

  const reserve = Number(finance.reserveEstimated ?? claim.finance.reserveEstimated ?? 0);
  const paid = Number(finance.paid ?? claim.finance.paid ?? 0);
  const deductible = Number(finance.deductible ?? claim.finance.deductible ?? 0);

  const recoverable = Math.max(0, paid - deductible);
  const outstanding = Math.max(0, reserve - paid);

  claim.finance = {
    currency: finance.currency || claim.finance.currency || "USD",
    reserveEstimated: reserve,
    paid,
    deductible,
    recoverable,
    outstanding,
    notes: finance.notes ?? claim.finance.notes ?? "",
  };

  claim.auditTrail.push({
    at: now,
    by,
    action: "FINANCE_UPDATED",
    note: `Finance updated (reserve=${reserve}, paid=${paid}, deductible=${deductible}, recoverable=${recoverable}, outstanding=${outstanding})`,
  });

  saveDB(db);
  return claim.finance;
}

function getDrafts(id) {
  const claim = getClaim(id);
  if (!claim) return null;
  return buildDraftTemplates(claim);
}

function getDueReminders() {
  const db = ensureDBShape(loadDB());
  const now = new Date();
  const due = [];

  for (const c of db.claims) {
    for (const a of c.actions || []) {
      if (!a.reminderAt) continue;
      const r = new Date(a.reminderAt);
      if (isNaN(r.getTime())) continue;
      if (r <= now && a.status !== "DONE") {
        due.push({
          claimId: c.id,
          claimNumber: c.claimNumber,
          vesselName: c.extraction?.vesselName || null,
          progressStatus: c.progressStatus,
          coverTypes: (c.classification?.covers || []).map((x) => x.type),
          actionId: a.id,
          actionTitle: a.title,
          ownerRole: a.ownerRole,
          reminderAt: a.reminderAt,
          dueAt: a.dueAt || null,
        });
      }
    }
  }

  due.sort((x, y) => new Date(x.reminderAt) - new Date(y.reminderAt));
  return due;
}

module.exports = {
  listClaims,
  getClaim,
  createClaim,
  updateProgressStatus,
  updateFinance,
  updateAction,
  getDrafts,
  getDueReminders,
};
