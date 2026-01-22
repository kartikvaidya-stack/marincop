// backend/services/claimService.js

const { v4: uuidv4 } = require("uuid");
const { loadDb, saveDb } = require("../utils/db");
const { extractFirstNotification } = require("../utils/extraction"); // async now
const { classifyCovers } = require("../utils/classification");

/**
 * Helpers
 */
function nowIso() {
  return new Date().toISOString();
}

function safeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function addDays(isoOrDate, days) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function computeOutstanding(fin) {
  const reserve = safeNumber(fin.reserveEstimated);
  const recovered = safeNumber(fin.recovered);
  return Math.max(0, reserve - recovered);
}

function nextClaimNumber(db, company, dt = new Date()) {
  const year = dt.getFullYear();
  const prefix = "MC";
  const companyCode = "NOVA";
  const existing = (db.claims || []).filter((c) =>
    (c.claimNumber || "").includes(`${prefix}-${companyCode}-${year}-`)
  );

  const nums = existing
    .map((c) => String(c.claimNumber || "").split("-").pop())
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n));

  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  const seq = String(next).padStart(4, "0");
  return `${prefix}-${companyCode}-${year}-${seq}`;
}

function buildDefaultActions(claimId, createdAtIso) {
  const baseIso = new Date(createdAtIso).toISOString();

  return [
    {
      id: `${claimId}-A1`,
      title: "Create claim file and preserve evidence",
      ownerRole: "Claims",
      dueAt: baseIso,
      status: "OPEN",
      createdAt: baseIso,
      updatedAt: baseIso,
      reminderAt: null,
      notes: "",
    },
    {
      id: `${claimId}-A2`,
      title: "Confirm cover(s) and notify relevant insurers/club",
      ownerRole: "Claims",
      dueAt: baseIso,
      status: "OPEN",
      createdAt: baseIso,
      updatedAt: baseIso,
      reminderAt: null,
      notes: "",
    },
    {
      id: `${claimId}-A3`,
      title: "Collect supporting documents (log extracts, photos, reports)",
      ownerRole: "Ops",
      dueAt: addDays(baseIso, 1),
      status: "OPEN",
      createdAt: baseIso,
      updatedAt: baseIso,
      reminderAt: null,
      notes: "",
    },
    {
      id: `${claimId}-A4`,
      title: "Appoint / confirm surveyor (if required)",
      ownerRole: "Claims",
      dueAt: addDays(baseIso, 1),
      status: "OPEN",
      createdAt: baseIso,
      updatedAt: baseIso,
      reminderAt: null,
      notes: "",
    },
    {
      id: `${claimId}-A5`,
      title: "Establish initial reserve (estimate) and deductible impact",
      ownerRole: "Finance",
      dueAt: addDays(baseIso, 2),
      status: "OPEN",
      createdAt: baseIso,
      updatedAt: baseIso,
      reminderAt: null,
      notes: "",
    },
    {
      id: `${claimId}-A6`,
      title: "Track updates and maintain status log",
      ownerRole: "Claims",
      dueAt: baseIso,
      status: "OPEN",
      createdAt: baseIso,
      updatedAt: baseIso,
      reminderAt: null,
      notes: "",
    },
    {
      id: `${claimId}-A7`,
      title: "Identify third-party involvement and liability exposure",
      ownerRole: "Claims",
      dueAt: addDays(baseIso, 1),
      status: "OPEN",
      createdAt: baseIso,
      updatedAt: baseIso,
      reminderAt: null,
      notes: "",
    },
    {
      id: `${claimId}-A8`,
      title: "Obtain statements (Master/crew) and incident report",
      ownerRole: "Ops",
      dueAt: addDays(baseIso, 1),
      status: "OPEN",
      createdAt: baseIso,
      updatedAt: baseIso,
      reminderAt: null,
      notes: "",
    },
    {
      id: `${claimId}-A9`,
      title: "Notify relevant correspondents / local agents if needed",
      ownerRole: "Claims",
      dueAt: addDays(baseIso, 1),
      status: "OPEN",
      createdAt: baseIso,
      updatedAt: baseIso,
      reminderAt: null,
      notes: "",
    },
  ];
}

/**
 * Service methods
 */
async function listClaims() {
  const db = loadDb();
  return (db.claims || []).map((c) => ({
    id: c.id,
    claimNumber: c.claimNumber,
    vesselName: c.extraction?.vesselName || c.vesselName || null,
    eventDateText: c.extraction?.eventDateText || null,
    locationText: c.extraction?.locationText || null,
    progressStatus: c.progressStatus,
    covers: (c.classification?.covers || []).map((x) => x.type),
    reserveEstimated: c.finance?.reserveEstimated || 0,
    recovered: c.finance?.recovered || 0,
    outstanding: c.finance?.outstanding || 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

async function createClaim({ createdBy, firstNotificationText }) {
  if (!createdBy) throw new Error("createdBy is required");
  if (!firstNotificationText) throw new Error("firstNotificationText is required");

  const db = loadDb();
  db.claims = db.claims || [];

  const createdAt = nowIso();
  const id = uuidv4();

  // ✅ AI-first extraction (async). Falls back inside extraction.js if AI fails.
  const extraction = await extractFirstNotification(firstNotificationText);
  const classification = classifyCovers(extraction);

  const company = "Nova Carriers";
  const claimNumber = nextClaimNumber(db, company, new Date(createdAt));

  const claim = {
    id,
    claimNumber,
    company,
    createdAt,
    createdBy,
    updatedAt: createdAt,

    progressStatus: "Notification Received",

    extraction,
    classification,

    actions: buildDefaultActions(id, createdAt),

    finance: {
      currency: "USD",
      reserveEstimated: 0,
      deductible: 0,
      recovered: 0,
      outstanding: 0,
      notes: "",
    },

    files: [],

    statusLog: [
      {
        at: createdAt,
        by: createdBy,
        status: "Notification Received",
        note: "Claim created from first notification.",
      },
    ],

    auditTrail: [
      {
        at: createdAt,
        by: createdBy,
        action: "STATUS_LOG_IMPORTED",
        note: "Notification Received - Claim created from first notification.",
      },
    ],
  };

  claim.finance.outstanding = computeOutstanding(claim.finance);

  db.claims.unshift(claim);
  saveDb(db);

  return claim;
}

async function getClaim(id) {
  const db = loadDb();
  return (db.claims || []).find((c) => c.id === id) || null;
}

async function updateProgress({ claimId, by, progressStatus }) {
  if (!by) throw new Error("by is required");
  if (!progressStatus) throw new Error("progressStatus is required");

  const db = loadDb();
  const claim = (db.claims || []).find((c) => c.id === claimId);
  if (!claim) throw new Error("Claim not found");

  const t = nowIso();
  claim.progressStatus = progressStatus;
  claim.updatedAt = t;

  claim.statusLog = claim.statusLog || [];
  claim.statusLog.push({ at: t, by, status: progressStatus, note: "Progress updated" });

  claim.auditTrail = claim.auditTrail || [];
  claim.auditTrail.push({
    at: t,
    by,
    action: "STATUS_UPDATED",
    note: `Progress set to: ${progressStatus}`,
  });

  saveDb(db);
  return { progressStatus };
}

async function updateFinance({ claimId, by, finance }) {
  if (!by) throw new Error("by is required");
  if (!finance) throw new Error("finance is required");

  const db = loadDb();
  const claim = (db.claims || []).find((c) => c.id === claimId);
  if (!claim) throw new Error("Claim not found");

  const t = nowIso();
  claim.finance = claim.finance || {};

  claim.finance.currency = finance.currency || claim.finance.currency || "USD";
  claim.finance.reserveEstimated = safeNumber(finance.reserveEstimated);
  claim.finance.deductible = safeNumber(finance.deductible);
  claim.finance.recovered = safeNumber(finance.recovered);
  claim.finance.notes = finance.notes || "";

  claim.finance.outstanding = computeOutstanding(claim.finance);

  claim.updatedAt = t;

  claim.auditTrail = claim.auditTrail || [];
  claim.auditTrail.push({
    at: t,
    by,
    action: "FINANCE_UPDATED",
    note: `Finance updated (reserve=${claim.finance.reserveEstimated}, recovered=${claim.finance.recovered}, outstanding=${claim.finance.outstanding})`,
  });

  saveDb(db);
  return claim.finance;
}

async function updateAction({ claimId, actionId, by, status, notes, reminderAt }) {
  if (!by) throw new Error("by is required");

  const db = loadDb();
  const claim = (db.claims || []).find((c) => c.id === claimId);
  if (!claim) throw new Error("Claim not found");

  claim.actions = claim.actions || [];
  const action = claim.actions.find((a) => a.id === actionId);
  if (!action) throw new Error("Action not found");

  const t = nowIso();

  if (status) action.status = status;
  if (typeof notes === "string") action.notes = notes;

  if (reminderAt === null) {
    action.reminderAt = null;
  } else if (typeof reminderAt === "string" && reminderAt.trim()) {
    const dt = new Date(reminderAt);
    if (!Number.isNaN(dt.getTime())) action.reminderAt = dt.toISOString();
  }

  action.updatedAt = t;
  claim.updatedAt = t;

  claim.auditTrail = claim.auditTrail || [];
  claim.auditTrail.push({
    at: t,
    by,
    action: "ACTION_UPDATED",
    note: `Action updated: ${action.title} (status=${action.status})`,
  });

  saveDb(db);
  return action;
}

/**
 * Reminders
 * - getDueReminders({before}) => all OPEN actions where reminderAt <= before
 * - snoozeActionReminder({claimId, actionId, by, snoozeDays})
 */
async function getDueReminders({ before }) {
  const cutoff = before instanceof Date ? before : new Date(before || Date.now());
  if (Number.isNaN(cutoff.getTime())) throw new Error("Invalid 'before' date");

  const db = loadDb();
  const out = [];

  for (const claim of db.claims || []) {
    for (const a of claim.actions || []) {
      if (!a.reminderAt) continue;
      if ((a.status || "").toUpperCase() === "DONE") continue;

      const r = new Date(a.reminderAt);
      if (Number.isNaN(r.getTime())) continue;

      if (r.getTime() <= cutoff.getTime()) {
        out.push({
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          vesselName: claim.extraction?.vesselName || claim.vesselName || null,
          progressStatus: claim.progressStatus,
          coverTypes: (claim.classification?.covers || []).map((x) => x.type),
          actionId: a.id,
          actionTitle: a.title,
          ownerRole: a.ownerRole,
          reminderAt: a.reminderAt,
          dueAt: a.dueAt || null,
        });
      }
    }
  }

  out.sort((x, y) => new Date(x.reminderAt).getTime() - new Date(y.reminderAt).getTime());
  return out;
}

async function snoozeActionReminder({ claimId, actionId, by, snoozeDays }) {
  if (!by) throw new Error("by is required");
  const days = Number(snoozeDays);
  if (!Number.isFinite(days) || days <= 0) throw new Error("snoozeDays must be a positive number");

  const db = loadDb();
  const claim = (db.claims || []).find((c) => c.id === claimId);
  if (!claim) throw new Error("Claim not found");

  claim.actions = claim.actions || [];
  const action = claim.actions.find((a) => a.id === actionId);
  if (!action) throw new Error("Action not found");

  const t = nowIso();
  const base = action.reminderAt ? new Date(action.reminderAt) : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + days);

  action.reminderAt = next.toISOString();
  action.updatedAt = t;
  claim.updatedAt = t;

  claim.auditTrail = claim.auditTrail || [];
  claim.auditTrail.push({
    at: t,
    by,
    action: "REMINDER_SNOOZED",
    note: `Reminder snoozed by ${days} day(s) for action: ${action.title}`,
  });

  saveDb(db);

  return { claimId, actionId, reminderAt: action.reminderAt };
}

module.exports = {
  listClaims,
  createClaim,
  getClaim,
  updateProgress,
  updateFinance,
  updateAction,
  getDueReminders,
  snoozeActionReminder,
};
