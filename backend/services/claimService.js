// backend/services/claimService.js
// Core claim operations + persistence (JSON file) + reminders + drafts.
// Includes AI-assisted extraction if available.
// Also exports compatibility function names used by older controllers/routes.

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const extractionUtil = require("../utils/extraction");
const classificationUtil = require("../utils/classification");

// ---------- Storage (JSON file) ----------
const DATA_FILE = path.join(process.cwd(), "database", "data", "claims.json");

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf8");
}

function readAllClaims() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const arr = JSON.parse(raw || "[]");
  return Array.isArray(arr) ? arr : [];
}

function writeAllClaims(claims) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(claims, null, 2), "utf8");
}

// ---------- Helpers ----------
function nowISO() {
  return new Date().toISOString();
}

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function safeObj(x) {
  return x && typeof x === "object" ? x : {};
}

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function computeOutstanding(fin) {
  const reserve = toNumber(fin.reserveEstimated);
  const recovered = toNumber(fin.recovered);
  const outstanding = Math.max(0, reserve - recovered);
  return { reserve, recovered, outstanding };
}

function nextClaimNumber(existingClaims, companyCode = "NOVA") {
  const year = new Date().getUTCFullYear();
  const prefix = `MC-${companyCode}-${year}-`;
  const nums = existingClaims
    .map((c) => c.claimNumber || "")
    .filter((x) => x.startsWith(prefix))
    .map((x) => {
      const last = x.split("-").pop();
      const n = Number(last);
      return Number.isFinite(n) ? n : 0;
    });
  const max = nums.length ? Math.max(...nums) : 0;
  const next = String(max + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

function defaultActions(claimId, createdAtISO) {
  const base = new Date(createdAtISO).getTime();
  const plusDays = (d) => new Date(base + d * 24 * 3600 * 1000).toISOString();

  return [
    { id: `${claimId}-A1`, title: "Create claim file and preserve evidence", ownerRole: "Claims", dueAt: createdAtISO, status: "OPEN", createdAt: createdAtISO, updatedAt: createdAtISO, reminderAt: null, notes: "" },
    { id: `${claimId}-A2`, title: "Confirm cover(s) and notify relevant insurers/club", ownerRole: "Claims", dueAt: createdAtISO, status: "OPEN", createdAt: createdAtISO, updatedAt: createdAtISO, reminderAt: null, notes: "" },
    { id: `${claimId}-A3`, title: "Collect supporting documents (log extracts, photos, reports)", ownerRole: "Ops", dueAt: plusDays(1), status: "OPEN", createdAt: createdAtISO, updatedAt: createdAtISO, reminderAt: null, notes: "" },
    { id: `${claimId}-A4`, title: "Appoint / confirm surveyor (if required)", ownerRole: "Claims", dueAt: plusDays(1), status: "OPEN", createdAt: createdAtISO, updatedAt: createdAtISO, reminderAt: null, notes: "" },
    { id: `${claimId}-A5`, title: "Establish initial reserve (estimate) and deductible impact", ownerRole: "Finance", dueAt: plusDays(2), status: "OPEN", createdAt: createdAtISO, updatedAt: createdAtISO, reminderAt: null, notes: "" },
    { id: `${claimId}-A6`, title: "Track updates and maintain status log", ownerRole: "Claims", dueAt: createdAtISO, status: "OPEN", createdAt: createdAtISO, updatedAt: createdAtISO, reminderAt: null, notes: "" },
    { id: `${claimId}-A7`, title: "Identify third-party involvement and liability exposure", ownerRole: "Claims", dueAt: plusDays(1), status: "OPEN", createdAt: createdAtISO, updatedAt: createdAtISO, reminderAt: null, notes: "" },
    { id: `${claimId}-A8`, title: "Obtain statements (Master/crew) and incident report", ownerRole: "Ops", dueAt: plusDays(1), status: "OPEN", createdAt: createdAtISO, updatedAt: createdAtISO, reminderAt: null, notes: "" },
    { id: `${claimId}-A9`, title: "Notify relevant correspondents / local agents if needed", ownerRole: "Claims", dueAt: plusDays(1), status: "OPEN", createdAt: createdAtISO, updatedAt: createdAtISO, reminderAt: null, notes: "" },
  ];
}

function ensureClaimShape(claim) {
  claim.actions = safeArray(claim.actions);
  claim.files = safeArray(claim.files);
  claim.statusLog = safeArray(claim.statusLog);
  claim.auditTrail = safeArray(claim.auditTrail);
  claim.finance = safeObj(claim.finance);
  claim.extraction = safeObj(claim.extraction);
  claim.classification = safeObj(claim.classification);

  const { reserve, recovered, outstanding } = computeOutstanding(claim.finance);
  claim.finance.reserveEstimated = reserve;
  claim.finance.recovered = recovered;
  claim.finance.outstanding = outstanding;

  return claim;
}

function addAudit(claim, by, action, note) {
  claim.auditTrail = safeArray(claim.auditTrail);
  claim.auditTrail.push({ at: nowISO(), by: by || "System", action, note: note || "" });
}

function addStatusLog(claim, by, status, note) {
  claim.statusLog = safeArray(claim.statusLog);
  claim.statusLog.push({ at: nowISO(), by: by || "System", status, note: note || "" });
}

// ---------- Main API ----------
async function createClaim({ company = "Nova Carriers", createdBy = "System", firstNotificationText = "" }) {
  const claims = readAllClaims();
  const id = randomUUID();
  const createdAt = nowISO();
  const companyCode = "NOVA";

  // extraction (AI-assisted if available)
  let extraction = null;
  if (typeof extractionUtil.extractFromFirstNotificationWithAI === "function") {
    extraction = await extractionUtil.extractFromFirstNotificationWithAI(firstNotificationText);
  } else {
    extraction = extractionUtil.extractFromFirstNotification(firstNotificationText);
  }

  const classification = classificationUtil.classifyFromExtraction(extraction);

  const claim = ensureClaimShape({
    id,
    claimNumber: nextClaimNumber(claims, companyCode),
    company,
    createdAt,
    updatedAt: createdAt,
    createdBy,
    progressStatus: "Notification Received",
    extraction,
    classification,
    actions: defaultActions(id, createdAt),
    finance: { currency: "USD", reserveEstimated: 0, deductible: 0, recovered: 0, outstanding: 0, notes: "" },
    files: [],
    statusLog: [{ at: createdAt, by: createdBy, status: "Notification Received", note: "Claim created from first notification." }],
    auditTrail: [],
  });

  addAudit(claim, createdBy, "CLAIM_CREATED", "Created claim from first notification");

  claims.unshift(claim);
  writeAllClaims(claims);

  return claim;
}

function listClaims() {
  const claims = readAllClaims().map(ensureClaimShape);
  return claims.map((c) => ({
    id: c.id,
    claimNumber: c.claimNumber,
    vesselName: c.extraction?.vesselName || null,
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

function getClaimById(id) {
  const claims = readAllClaims().map(ensureClaimShape);
  return claims.find((c) => c.id === id) || null;
}

function saveClaim(updatedClaim) {
  const claims = readAllClaims().map(ensureClaimShape);
  const idx = claims.findIndex((c) => c.id === updatedClaim.id);
  if (idx === -1) return null;
  updatedClaim.updatedAt = nowISO();
  claims[idx] = ensureClaimShape(updatedClaim);
  writeAllClaims(claims);
  return claims[idx];
}

function updateProgress(claimId, { by = "System", progressStatus = "" }) {
  const claim = getClaimById(claimId);
  if (!claim) return null;
  claim.progressStatus = progressStatus || claim.progressStatus;
  addStatusLog(claim, by, claim.progressStatus, "Progress updated");
  addAudit(claim, by, "STATUS_UPDATED", `Progress set to: ${claim.progressStatus}`);
  return saveClaim(claim);
}

function updateFinance(claimId, { by = "System", finance = {} }) {
  const claim = getClaimById(claimId);
  if (!claim) return null;

  claim.finance = { ...safeObj(claim.finance), ...safeObj(finance) };
  const { reserve, recovered, outstanding } = computeOutstanding(claim.finance);
  claim.finance.reserveEstimated = reserve;
  claim.finance.recovered = recovered;
  claim.finance.outstanding = outstanding;

  addAudit(claim, by, "FINANCE_UPDATED", `Finance updated (reserve=${reserve}, recovered=${recovered}, outstanding=${outstanding})`);
  return saveClaim(claim);
}

function updateAction(claimId, actionId, { by = "System", status, notes, reminderAt }) {
  const claim = getClaimById(claimId);
  if (!claim) return null;

  const idx = claim.actions.findIndex((a) => a.id === actionId);
  if (idx === -1) return null;

  const a = { ...claim.actions[idx] };
  if (status) a.status = status;
  if (typeof notes === "string") a.notes = notes;
  if (reminderAt === null) a.reminderAt = null;
  if (typeof reminderAt === "string") a.reminderAt = reminderAt;
  a.updatedAt = nowISO();

  claim.actions[idx] = a;

  addAudit(claim, by, "ACTION_UPDATED", `Action updated: ${a.title} (status=${a.status})`);
  return saveClaim(claim);
}

function getDueReminders() {
  const claims = readAllClaims().map(ensureClaimShape);
  const now = Date.now();

  const due = [];
  for (const c of claims) {
    for (const a of safeArray(c.actions)) {
      if (a.status !== "OPEN") continue;
      if (!a.reminderAt) continue;
      const t = Date.parse(a.reminderAt);
      if (!Number.isFinite(t)) continue;
      if (t <= now) {
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
          dueAt: a.dueAt,
        });
      }
    }
  }
  due.sort((x, y) => Date.parse(x.reminderAt) - Date.parse(y.reminderAt));
  return due;
}

function generateDraftTemplates(claimId) {
  const claim = getClaimById(claimId);
  if (!claim) return null;

  const claimNumber = claim.claimNumber;
  const vessel = claim.extraction?.vesselName || "Vessel TBN";
  const imo = claim.extraction?.imo ? ` (IMO ${claim.extraction.imo})` : "";
  const dateText = claim.extraction?.eventDateText || "Date TBN";
  const loc = claim.extraction?.locationText || "Location/Position TBN";
  const raw = claim.extraction?.rawText || "";

  return [
    {
      type: "P&I_NOTIFICATION",
      subject: `[${claimNumber}] - ${vessel} - P&I Notification (Initial)`,
      body:
        `Dear P&I Club / Correspondents,\n\n` +
        `We hereby give initial notification of an incident that may give rise to liabilities and/or costs falling within P&I cover.\n\n` +
        `Claim Ref: ${claimNumber}\n` +
        `Vessel: ${vessel}${imo}\n` +
        `Date/Time (as advised): ${dateText}\n` +
        `Location/Position: ${loc}\n\n` +
        `Initial description (as received):\n${raw}\n\n` +
        `Immediate actions taken / proposed:\n` +
        `- Evidence preservation initiated (photos, statements, log extracts)\n` +
        `- Request guidance on next steps and appointment of surveyor (if required)\n` +
        `- Please advise any specific reporting format / documents required\n\n` +
        `Kindly acknowledge receipt and advise recommended course of action, including any correspondent/surveyor nomination.\n\n` +
        `Best regards,\nNova Carriers\n(Claims Team)`,
    },
    {
      type: "SURVEYOR_APPOINTMENT",
      subject: `[${claimNumber}] - ${vessel} - Survey Appointment Request`,
      body:
        `Dear Sir/Madam,\n\n` +
        `Nova Carriers requests your attendance / appointment as surveyor in relation to the below incident.\n\n` +
        `Claim Ref: ${claimNumber}\n` +
        `Vessel: ${vessel}${imo}\n` +
        `Incident date: ${dateText}\n` +
        `Location: ${loc}\n\n` +
        `Please confirm:\n` +
        `1) Earliest attendance and ETA\n` +
        `2) Information/documents required prior attendance\n` +
        `3) Expected deliverables and timeline for preliminary and final report\n\n` +
        `We will provide photographs, statements, and relevant extracts upon confirmation.\n\n` +
        `Best regards,\nNova Carriers\n(Claims Team)`,
    },
    {
      type: "CHASE_REMINDER",
      subject: `[${claimNumber}] - ${vessel} - Follow-up / Chase`,
      body:
        `Dear All,\n\n` +
        `Gentle reminder / follow-up in relation to Claim Ref ${claimNumber} (${vessel}).\n\n` +
        `Pending items:\n` +
        claim.actions
          .filter((a) => a.status === "OPEN")
          .slice(0, 5)
          .map((a) => `- ${a.title}`)
          .join("\n") +
        `\n\nKindly provide an update and expected timeline for closure.\n\n` +
        `Best regards,\nNova Carriers\n(Claims Team)`,
    },
  ];
}

// ---------- Compatibility exports (older controllers expect these names) ----------
function getClaims() {
  return listClaims();
}
function getClaim(id) {
  return getClaimById(id);
}
function patchProgress(claimId, payload) {
  return updateProgress(claimId, payload);
}
function patchFinance(claimId, payload) {
  return updateFinance(claimId, payload);
}
function patchAction(claimId, actionId, payload) {
  return updateAction(claimId, actionId, payload);
}
function getDrafts(claimId) {
  return generateDraftTemplates(claimId);
}
function getRemindersDue() {
  return getDueReminders();
}

module.exports = {
  // new names
  createClaim,
  listClaims,
  getClaimById,
  updateProgress,
  updateFinance,
  updateAction,
  getDueReminders,
  generateDraftTemplates,

  // compatibility names
  getClaims,
  getClaim,
  patchProgress,
  patchFinance,
  patchAction,
  getDrafts,
  getRemindersDue,
};
