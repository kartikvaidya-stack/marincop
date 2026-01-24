// backend/services/claimService.js
const { v4: uuidv4 } = require("uuid");

/**
 * Robust importer: tries multiple filenames to avoid MODULE_NOT_FOUND
 * (your project has had different util filenames across iterations).
 */
function requireFirst(paths) {
  for (const p of paths) {
    try {
      return require(p);
    } catch (e) {
      // keep trying
    }
  }
  const err = new Error(
    "Error: Marincop import error. Tried:\n- " + paths.join("\n- ")
  );
  throw err;
}

function nowIso() {
  return new Date().toISOString();
}

/** Safely get a function by trying multiple possible export names */
function pickFn(mod, names, label) {
  for (const n of names) {
    if (mod && typeof mod[n] === "function") return mod[n];
  }
  throw new Error(`Marincop: missing function for ${label}. Tried: ${names.join(", ")}`);
}

/** -------------------------
 *  Load utils (robust)
 *  ------------------------- */
const dbMod = requireFirst(["../utils/db", "../utils/dbUtil", "../utils/dbUtils"]);
const loadDB = pickFn(dbMod, ["loadDB", "loadDb"], "loadDB");
const saveDB = pickFn(dbMod, ["saveDB", "saveDb"], "saveDB");
const ensureDBShape = pickFn(dbMod, ["ensureDBShape", "ensureDbShape"], "ensureDBShape");
const nextClaimSequenceForYear = pickFn(
  dbMod,
  ["nextClaimSequenceForYear", "nextClaimSequence", "nextSequenceForYear"],
  "nextClaimSequenceForYear"
);

const extractionUtil = requireFirst(["../utils/extractionUtil", "../utils/extraction"]);
const extractFromFirstNotification = pickFn(
  extractionUtil,
  ["extractFromFirstNotification", "extract", "extractFirstNotification"],
  "extractFromFirstNotification"
);

const classificationUtil = requireFirst(["../utils/classificationUtil", "../utils/classification"]);
const classifyFromExtraction = pickFn(
  classificationUtil,
  ["classifyFromExtraction", "classify"],
  "classifyFromExtraction"
);

const actionsUtil = requireFirst(["../utils/actionsUtil", "../utils/actions", "../utils/actionUtil"]);
const defaultActionsForClassification = pickFn(
  actionsUtil,
  ["defaultActionsForClassification", "defaultActions", "buildDefaultActions"],
  "defaultActionsForClassification"
);

const draftsUtil = requireFirst(["../utils/draftsUtil", "../utils/drafts"]);
const generateDrafts = pickFn(
  draftsUtil,
  ["generateDrafts", "buildDrafts", "draftsForClaim"],
  "generateDrafts"
);

/**
 * Owner-view finance model (Nova POV):
 * - reserveEstimated: insurer reserve (exposure)
 * - cashOut: owner's cash paid out (keeps increasing)
 * - deductible: owner's deductible
 * - recoverableExpected = max(0, cashOut - deductible)
 * - recovered: cash received back (insurers/third parties)
 * - outstandingRecovery = max(0, recoverableExpected - recovered)
 */
function normalizeFinance(input = {}, existing = {}) {
  const currency = input.currency ?? existing.currency ?? "USD";

  const reserveEstimated = Number.isFinite(Number(input.reserveEstimated))
    ? Number(input.reserveEstimated)
    : Number(existing.reserveEstimated || 0);

  const cashOut = Number.isFinite(Number(input.cashOut))
    ? Number(input.cashOut)
    : Number(existing.cashOut || 0);

  const deductible = Number.isFinite(Number(input.deductible))
    ? Number(input.deductible)
    : Number(existing.deductible || 0);

  const recovered = Number.isFinite(Number(input.recovered))
    ? Number(input.recovered)
    : Number(existing.recovered || 0);

  const notes = input.notes !== undefined ? String(input.notes || "") : String(existing.notes || "");

  const recoverableExpected = Math.max(0, cashOut - deductible);
  const outstandingRecovery = Math.max(0, recoverableExpected - recovered);

  return {
    currency,
    reserveEstimated,
    cashOut,
    deductible,
    recoverableExpected,
    recovered,
    outstandingRecovery,
    notes,
  };
}

function ensureClaimShape(claim) {
  if (!claim.finance) claim.finance = normalizeFinance({}, {});
  else claim.finance = normalizeFinance({}, claim.finance);

  if (!Array.isArray(claim.actions)) claim.actions = [];
  if (!Array.isArray(claim.files)) claim.files = [];
  if (!Array.isArray(claim.statusLog)) claim.statusLog = [];
  if (!Array.isArray(claim.auditTrail)) claim.auditTrail = [];
  if (!claim.classification) claim.classification = { covers: [] };
  if (!claim.extraction) claim.extraction = {};
  if (!claim.progressStatus) claim.progressStatus = "Notification Received";
  return claim;
}

function addAudit(claim, by, action, note) {
  if (!Array.isArray(claim.auditTrail)) claim.auditTrail = [];
  claim.auditTrail.push({ at: nowIso(), by: by || "System", action, note: note || "" });
}

/** -------------------------
 *  Core service functions
 *  ------------------------- */

function listClaims() {
  const db = ensureDBShape(loadDB());
  const claims = (db.claims || []).map(ensureClaimShape);

  return claims
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((c) => {
      const f = c.finance || normalizeFinance({}, {});
      return {
        id: c.id,
        claimNumber: c.claimNumber,
        vesselName: c.extraction?.vesselName || c.vesselName || null,
        eventDateText: c.extraction?.eventDateText || c.eventDateText || null,
        locationText: c.extraction?.locationText || c.locationText || null,
        progressStatus: c.progressStatus,
        covers: (c.classification?.covers || []).map((x) => x.type),
        currency: f.currency || "USD",
        reserveEstimated: f.reserveEstimated || 0,
        cashOut: f.cashOut || 0,
        deductible: f.deductible || 0,
        recoverableExpected: f.recoverableExpected || 0,
        recovered: f.recovered || 0,
        outstandingRecovery: f.outstandingRecovery || 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });
}

function getClaim(id) {
  const db = ensureDBShape(loadDB());
  const claim = (db.claims || []).find((c) => c.id === id);
  if (!claim) return null;
  return ensureClaimShape(claim);
}

function createClaim({ createdBy, company, firstNotificationText }) {
  const db = ensureDBShape(loadDB());
  const year = new Date().getFullYear();
  const seq = nextClaimSequenceForYear(db, year);
  const claimNumber = `MC-NOVA-${year}-${String(seq).padStart(4, "0")}`;

  const createdAt = nowIso();

  // AI-ish extraction/classification (current util version)
  const extraction = extractFromFirstNotification(firstNotificationText || "");
  const classification = classifyFromExtraction(extraction, firstNotificationText || "");

  const claim = ensureClaimShape({
    id: uuidv4(),
    claimNumber,
    company: company || "Nova Carriers",
    createdAt,
    updatedAt: createdAt,
    createdBy: createdBy || "Unknown",
    progressStatus: "Notification Received",

    extraction: {
      rawText: firstNotificationText || "",
      summary: extraction.summary || firstNotificationText || "",
      vesselName: extraction.vesselName || null,
      imo: extraction.imo || null,
      eventDateText: extraction.eventDateText || null,
      locationText: extraction.locationText || null,
      incidentKeywords: extraction.incidentKeywords || [],
      counterpartyText: extraction.counterpartyText || null,
    },

    classification,
    actions: defaultActionsForClassification(classification),
    files: [],
    statusLog: [
      {
        at: createdAt,
        by: createdBy || "Unknown",
        status: "Notification Received",
        note: "Claim created from first notification.",
      },
    ],
    auditTrail: [],
    finance: normalizeFinance({}, {}),
  });

  addAudit(claim, createdBy, "CLAIM_CREATED", `Created claim ${claimNumber}`);
  db.claims.push(claim);
  saveDB(db);
  return claim;
}

function patchProgress({ id, by, progressStatus }) {
  const db = ensureDBShape(loadDB());
  const claim = (db.claims || []).find((c) => c.id === id);
  if (!claim) return null;

  ensureClaimShape(claim);

  claim.progressStatus = progressStatus || claim.progressStatus;
  claim.updatedAt = nowIso();

  claim.statusLog.push({
    at: claim.updatedAt,
    by: by || "Unknown",
    status: claim.progressStatus,
    note: "Progress updated",
  });

  addAudit(claim, by, "STATUS_UPDATED", `Progress set to: ${claim.progressStatus}`);
  saveDB(db);
  return claim;
}

function patchFinance({ id, by, finance }) {
  const db = ensureDBShape(loadDB());
  const claim = (db.claims || []).find((c) => c.id === id);
  if (!claim) return null;

  ensureClaimShape(claim);

  const prev = claim.finance || normalizeFinance({}, {});
  claim.finance = normalizeFinance(finance || {}, prev);
  claim.updatedAt = nowIso();

  addAudit(
    claim,
    by,
    "FINANCE_UPDATED",
    `Finance updated (reserve=${claim.finance.reserveEstimated}, cashOut=${claim.finance.cashOut}, recovered=${claim.finance.recovered}, outstandingRecovery=${claim.finance.outstandingRecovery})`
  );

  saveDB(db);
  return claim.finance;
}

function patchAction({ id, actionId, by, status, notes, reminderAt }) {
  const db = ensureDBShape(loadDB());
  const claim = (db.claims || []).find((c) => c.id === id);
  if (!claim) return null;

  ensureClaimShape(claim);

  const a = (claim.actions || []).find((x) => x.id === actionId);
  if (!a) return null;

  if (status !== undefined) a.status = status;
  if (notes !== undefined) a.notes = String(notes || "");
  if (reminderAt !== undefined) a.reminderAt = reminderAt; // ISO string or null

  a.updatedAt = nowIso();
  claim.updatedAt = a.updatedAt;

  addAudit(claim, by, "ACTION_UPDATED", `Action updated: ${a.title} (status=${a.status})`);
  saveDB(db);
  return a;
}

function getDrafts(id) {
  const claim = getClaim(id);
  if (!claim) return null;
  return generateDrafts(claim);
}

function getDueReminders() {
  const db = ensureDBShape(loadDB());
  const claims = (db.claims || []).map(ensureClaimShape);
  const now = Date.now();

  const out = [];

  for (const c of claims) {
    for (const a of c.actions || []) {
      if (!a.reminderAt) continue;
      const t = new Date(a.reminderAt).getTime();
      if (Number.isNaN(t)) continue;
      if (t <= now && a.status !== "DONE") {
        out.push({
          claimId: c.id,
          claimNumber: c.claimNumber,
          vesselName: c.extraction?.vesselName || c.vesselName || null,
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

  out.sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime());
  return out;
}

module.exports = {
  listClaims,
  getClaim,
  createClaim,
  patchProgress,
  patchFinance,
  patchAction,
  getDrafts,
  getDueReminders,
};
