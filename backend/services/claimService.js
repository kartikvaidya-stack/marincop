// backend/services/claimService.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------- File storage ----------
function claimsFilePath() {
  // project root is where you run: cd ~/marincop && npm run dev
  return path.join(process.cwd(), "database", "data", "claims.json");
}

function ensureClaimsFile() {
  const fp = claimsFilePath();
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify([], null, 2), "utf8");
}

function readAllClaims() {
  ensureClaimsFile();
  const raw = fs.readFileSync(claimsFilePath(), "utf8");
  try {
    const data = JSON.parse(raw || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeAllClaims(claims) {
  ensureClaimsFile();
  fs.writeFileSync(claimsFilePath(), JSON.stringify(claims, null, 2), "utf8");
}

// ---------- Small helpers ----------
function nowIso() {
  return new Date().toISOString();
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function max0(n) {
  return Math.max(0, safeNum(n));
}

function uid() {
  return crypto.randomUUID();
}

// ---------- Extraction (basic) ----------
function extractFromText(rawText) {
  const text = String(rawText || "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Vessel name patterns: "Vessel: MV XXX", "M/V XXX", "MV XXX", "MT XXX"
  let vesselName = null;

  const vesselLine =
    lines.find((l) => /^vessel\s*:/i.test(l)) ||
    lines.find((l) => /^(m\/v|mv|m\.v\.|mt|m\/t)\s+/i.test(l));

  if (vesselLine) {
    vesselName = vesselLine
      .replace(/^vessel\s*:\s*/i, "")
      .replace(/^(m\/v|m\.v\.|mv|m\/t|mt)\s+/i, (m) => m.toUpperCase())
      .trim();
  }

  // IMO patterns
  let imo = null;
  const imoLine = lines.find((l) => /^imo\s*:/i.test(l)) || lines.find((l) => /\bIMO\b/i.test(l));
  if (imoLine) {
    const m = imoLine.match(/(\d{7})/);
    if (m) imo = m[1];
  }

  // Date patterns (simple: "22 Jan 2026", "21 January 2026", "2026-01-22")
  let eventDateText = null;
  const dateLine =
    lines.find((l) => /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\b/i.test(l)) ||
    lines.find((l) => /\b\d{4}-\d{2}-\d{2}\b/.test(l)) ||
    lines.find((l) => /^date\s*:/i.test(l));
  if (dateLine) {
    eventDateText = dateLine.replace(/^date\s*:\s*/i, "").trim();
  }

  // Location/Position patterns
  let locationText = null;
  const locLine = lines.find((l) => /^(position|location)\s*:/i.test(l));
  if (locLine) {
    locationText = locLine.replace(/^(position|location)\s*:\s*/i, "").trim();
  }

  // Keywords
  const lower = text.toLowerCase();
  const incidentKeywords = [];
  ["collision", "contact", "grounding", "fire", "pollution", "spill", "injury", "death", "cargo", "theft", "piracy", "tow"].forEach(
    (k) => {
      if (lower.includes(k)) incidentKeywords.push(k);
    }
  );

  return {
    rawText: text,
    summary: text.length > 1200 ? text.slice(0, 1200) + "…" : text,
    vesselName,
    imo,
    eventDateText,
    locationText,
    incidentKeywords,
    counterpartyText: null,
  };
}

// ---------- Classification ----------
function classifyFromExtraction(extraction) {
  const text = (extraction?.rawText || "").toLowerCase();

  const covers = [];

  // Charterers Liability — important per your feedback
  const charterHints = [
    "chartered vessel",
    "charterer",
    "charterers",
    "on hire",
    "time charter",
    "voyage charter",
    "t/c",
    "v/c",
    "hired",
    "fixture",
  ];
  const isCharterRelated = charterHints.some((h) => text.includes(h));

  const hasCargo = ["cargo", "wet damage", "contamination", "shortage", "shifted", "pulp", "coal", "grain", "steel", "bags"].some((h) =>
    text.includes(h)
  );
  const hasLiability = ["contact", "collision", "injury", "death", "pilot", "berth", "jetty", "pollution", "spill"].some((h) => text.includes(h));
  const hasHM = ["damage to hull", "denting", "shell plating", "engine", "machinery", "propeller", "rudder", "fire", "grounding"].some((h) =>
    text.includes(h)
  );

  if (isCharterRelated) {
    covers.push({
      type: "Charterers Liability",
      confidence: 0.8,
      reasoning: "Notification text indicates charterer/hire/fixture context; potential charterers’ liabilities may arise.",
    });
  }

  if (hasLiability) {
    covers.push({
      type: "P&I",
      confidence: 0.85,
      reasoning: "Indicators of third-party liabilities (contact/collision/injury/pollution/berth damage) align with P&I.",
    });
  }

  if (hasHM) {
    covers.push({
      type: "H&M",
      confidence: 0.75,
      reasoning: "Indicators of damage to vessel hull/machinery or casualty align with Hull & Machinery cover.",
    });
  }

  if (hasCargo) {
    covers.push({
      type: "Cargo",
      confidence: 0.7,
      reasoning: "Indicators of cargo damage/shortage/contamination align with Cargo-related claims handling.",
    });
  }

  if (covers.length === 0) {
    covers.push({
      type: "To Be Confirmed",
      confidence: 0.5,
      reasoning: "Insufficient information to classify confidently; requires further details.",
    });
  }

  return { covers };
}

// ---------- Actions + Drafts ----------
function defaultActions(claimId, createdAtIso) {
  const baseDue = new Date(createdAtIso);
  const plus = (days) => new Date(baseDue.getTime() + days * 24 * 3600 * 1000).toISOString();

  const mk = (n, title, ownerRole, days) => ({
    id: `${claimId}-A${n}`,
    title,
    ownerRole,
    dueAt: plus(days),
    status: "OPEN",
    createdAt: createdAtIso,
    updatedAt: createdAtIso,
    reminderAt: null,
    notes: "",
  });

  return [
    mk(1, "Create claim file and preserve evidence", "Claims", 0),
    mk(2, "Confirm cover(s) and notify relevant insurers/club", "Claims", 0),
    mk(3, "Collect supporting documents (log extracts, photos, reports)", "Ops", 1),
    mk(4, "Appoint / confirm surveyor (if required)", "Claims", 1),
    mk(5, "Establish initial reserve / cash-out and deductible impact", "Finance", 2),
    mk(6, "Track updates and maintain status log", "Claims", 0),
    mk(7, "Identify third-party involvement and liability exposure", "Claims", 1),
    mk(8, "Obtain statements (Master/crew) and incident report", "Ops", 1),
    mk(9, "Notify relevant correspondents / local agents if needed", "Claims", 1),
  ];
}

function draftTemplatesForClaim(claim) {
  const claimNumber = claim.claimNumber;
  const vessel = claim.extraction?.vesselName || claim.vesselName || "Vessel";
  const imo = claim.extraction?.imo ? ` (IMO ${claim.extraction.imo})` : "";
  const eventDate = claim.extraction?.eventDateText || claim.eventDateText || "(date tbc)";
  const location = claim.extraction?.locationText || claim.locationText || "(location tbc)";
  const desc = (claim.extraction?.rawText || "").trim();

  const covers = Array.isArray(claim.covers) ? claim.covers : [];
  const hasPI = covers.includes("P&I");
  const hasHM = covers.includes("H&M");
  const hasCharter = covers.includes("Charterers Liability");

  const drafts = [];

  if (hasPI) {
    drafts.push({
      type: "P&I_NOTIFICATION",
      subject: `[${claimNumber}] - ${vessel}${imo} - P&I Notification (Initial)`,
      body:
        `Dear P&I Club / Correspondents,\n\n` +
        `We hereby give initial notification of an incident that may give rise to liabilities and/or costs falling within P&I cover.\n\n` +
        `Claim Ref: ${claimNumber}\nVessel: ${vessel}${imo}\nDate/Time (as advised): ${eventDate}\nLocation/Position: ${location}\n\n` +
        `Initial description (as received):\n${desc}\n\n` +
        `Immediate actions taken / proposed:\n` +
        `- Evidence preservation initiated (photos, statements, log extracts)\n` +
        `- Request guidance on next steps and appointment of surveyor (if required)\n` +
        `- Please advise any specific reporting format / documents required\n\n` +
        `Kindly acknowledge receipt and advise recommended course of action, including any correspondent/surveyor nomination.\n\n` +
        `Best regards,\nNova Carriers\n(Claims Team)`,
    });
  }

  if (hasHM) {
    drafts.push({
      type: "HM_NOTIFICATION",
      subject: `[${claimNumber}] - ${vessel}${imo} - H&M Notification (Initial)`,
      body:
        `Dear Underwriters,\n\n` +
        `We hereby notify an incident that may give rise to a claim under Hull & Machinery.\n\n` +
        `Claim Ref: ${claimNumber}\nVessel: ${vessel}${imo}\nDate/Time (as advised): ${eventDate}\nLocation/Position: ${location}\n\n` +
        `Initial description (as received):\n${desc}\n\n` +
        `We will follow with supporting documents and surveyor details as available.\n\n` +
        `Best regards,\nNova Carriers\n(Claims Team)`,
    });
  }

  if (hasCharter) {
    drafts.push({
      type: "CHARTERERS_LIABILITY_NOTICE",
      subject: `[${claimNumber}] - ${vessel}${imo} - Charterers Liability Notice (Initial)`,
      body:
        `Dear Underwriters,\n\n` +
        `We hereby provide initial notice of circumstances arising in a charter context that may give rise to liabilities and/or costs.\n\n` +
        `Claim Ref: ${claimNumber}\nVessel: ${vessel}${imo}\nDate/Time (as advised): ${eventDate}\nLocation/Position: ${location}\n\n` +
        `Initial description (as received):\n${desc}\n\n` +
        `Please confirm coverage position and advise documents required. We will provide further updates.\n\n` +
        `Best regards,\nNova Carriers\n(Claims Team)`,
    });
  }

  drafts.push({
    type: "SURVEYOR_APPOINTMENT",
    subject: `[${claimNumber}] - ${vessel} - Survey Appointment Request`,
    body:
      `Dear Sir/Madam,\n\n` +
      `Nova Carriers requests your attendance / appointment as surveyor in relation to the below incident.\n\n` +
      `Claim Ref: ${claimNumber}\nVessel: ${vessel}\nIncident date: ${eventDate}\nLocation: ${location}\n\n` +
      `Please confirm:\n1) Earliest attendance and ETA\n2) Information/documents required prior attendance\n3) Expected deliverables and timeline for preliminary and final report\n\n` +
      `We will provide photographs, statements, and relevant extracts upon confirmation.\n\n` +
      `Best regards,\nNova Carriers\n(Claims Team)`,
  });

  return drafts;
}

// ---------- Finance model (returns BOTH schemas) ----------
function normalizeFinance(financeIn) {
  const fin = financeIn || {};
  const currency = fin.currency || "USD";

  const reserveEstimated = safeNum(fin.reserveEstimated ?? fin.reserveEstimated);
  const paid = safeNum(fin.paid ?? fin.cashOut ?? fin.cash_out ?? 0); // legacy paid
  const deductible = safeNum(fin.deductible ?? 0);
  const recovered = safeNum(fin.recovered ?? 0);

  // Canonical “owner-view” fields
  const cashOut = paid; // alias
  const recoverableExpected = max0(paid - deductible);
  const outstandingRecovery = max0(recoverableExpected - recovered);

  // Legacy fields expected by older UI
  const recoverable = recoverableExpected;
  const outstanding = outstandingRecovery;

  const notes = fin.notes || "";

  return {
    currency,
    reserveEstimated,

    // legacy fields
    paid,
    recoverable,
    outstanding,

    // canonical fields
    cashOut,
    deductible,
    recoverableExpected,
    recovered,
    outstandingRecovery,

    notes,
  };
}

function claimSummary(claim) {
  const fin = normalizeFinance(claim.finance || {});
  const covers = Array.isArray(claim.covers) ? claim.covers : [];

  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    vesselName: claim.extraction?.vesselName || claim.vesselName || null,
    eventDateText: claim.extraction?.eventDateText || claim.eventDateText || null,
    locationText: claim.extraction?.locationText || claim.locationText || null,
    progressStatus: claim.progressStatus || "Notification Received",
    covers,

    // keep both
    currency: fin.currency,
    reserveEstimated: fin.reserveEstimated,
    paid: fin.paid,
    deductible: fin.deductible,
    recoverable: fin.recoverable,
    recovered: fin.recovered,
    outstanding: fin.outstanding,

    // also provide canonical
    cashOut: fin.cashOut,
    recoverableExpected: fin.recoverableExpected,
    outstandingRecovery: fin.outstandingRecovery,

    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };
}

// ---------- Claim number ----------
function nextClaimNumber(allClaims, company) {
  const year = new Date().getFullYear();
  const prefix = `MC-NOVA-${year}-`;
  const nums = allClaims
    .map((c) => String(c.claimNumber || ""))
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.replace(prefix, ""), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ---------- Public API used by controllers ----------
async function createClaim({ company = "Nova Carriers", createdBy = "System", firstNotificationText = "" }) {
  const claims = readAllClaims();
  const id = uid();
  const createdAt = nowIso();

  const extraction = extractFromText(firstNotificationText);
  const classification = classifyFromExtraction(extraction);

  const covers = (classification?.covers || []).map((c) => c.type);

  const claim = {
    id,
    claimNumber: nextClaimNumber(claims, company),
    company,
    createdAt,
    createdBy,
    updatedAt: createdAt,
    progressStatus: "Notification Received",

    extraction,
    classification,

    vesselName: extraction.vesselName || null,
    eventDateText: extraction.eventDateText || null,
    locationText: extraction.locationText || null,

    covers,

    actions: defaultActions(id, createdAt),
    finance: normalizeFinance({ currency: "USD" }),
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
        action: "CLAIM_CREATED",
        note: "Claim created from first notification text.",
      },
    ],
  };

  claims.unshift(claim);
  writeAllClaims(claims);

  return claim;
}

async function listClaims() {
  const claims = readAllClaims();
  return claims.map(claimSummary);
}

async function getClaim(id) {
  const claims = readAllClaims();
  const claim = claims.find((c) => c.id === id);
  if (!claim) return null;

  // normalize finance for detail too
  claim.finance = normalizeFinance(claim.finance || {});
  return claim;
}

async function patchProgress(id, { by = "System", progressStatus }) {
  const claims = readAllClaims();
  const idx = claims.findIndex((c) => c.id === id);
  if (idx < 0) return null;

  const claim = claims[idx];
  const at = nowIso();

  claim.progressStatus = progressStatus || claim.progressStatus || "Updated";
  claim.updatedAt = at;

  claim.statusLog = Array.isArray(claim.statusLog) ? claim.statusLog : [];
  claim.statusLog.push({ at, by, status: claim.progressStatus, note: "Progress updated" });

  claim.auditTrail = Array.isArray(claim.auditTrail) ? claim.auditTrail : [];
  claim.auditTrail.push({ at, by, action: "STATUS_UPDATED", note: `Progress set to: ${claim.progressStatus}` });

  claims[idx] = claim;
  writeAllClaims(claims);

  return claim;
}

async function patchFinance(id, { by = "System", finance }) {
  const claims = readAllClaims();
  const idx = claims.findIndex((c) => c.id === id);
  if (idx < 0) return null;

  const claim = claims[idx];
  const at = nowIso();

  // merge + normalize
  const merged = { ...(claim.finance || {}), ...(finance || {}) };
  claim.finance = normalizeFinance(merged);
  claim.updatedAt = at;

  claim.auditTrail = Array.isArray(claim.auditTrail) ? claim.auditTrail : [];
  claim.auditTrail.push({
    at,
    by,
    action: "FINANCE_UPDATED",
    note: `Finance updated (paid=${claim.finance.paid}, deductible=${claim.finance.deductible}, recovered=${claim.finance.recovered}, outstanding=${claim.finance.outstandingRecovery})`,
  });

  claims[idx] = claim;
  writeAllClaims(claims);

  return claim;
}

async function patchAction(id, actionId, { by = "System", status, notes, reminderAt }) {
  const claims = readAllClaims();
  const idx = claims.findIndex((c) => c.id === id);
  if (idx < 0) return null;

  const claim = claims[idx];
  const at = nowIso();

  claim.actions = Array.isArray(claim.actions) ? claim.actions : [];
  const aIdx = claim.actions.findIndex((a) => a.id === actionId);
  if (aIdx < 0) return null;

  const action = claim.actions[aIdx];

  if (status) action.status = status;
  if (typeof notes === "string") action.notes = notes;
  if (reminderAt !== undefined) action.reminderAt = reminderAt; // allow null

  action.updatedAt = at;
  claim.updatedAt = at;

  claim.actions[aIdx] = action;

  claim.auditTrail = Array.isArray(claim.auditTrail) ? claim.auditTrail : [];
  claim.auditTrail.push({
    at,
    by,
    action: "ACTION_UPDATED",
    note: `Action updated: ${action.title} (status=${action.status})`,
  });

  claims[idx] = claim;
  writeAllClaims(claims);

  return action;
}

async function getDrafts(id) {
  const claim = await getClaim(id);
  if (!claim) return null;
  return draftTemplatesForClaim(claim);
}

async function getDueReminders() {
  const claims = readAllClaims();
  const now = Date.now();

  const rows = [];

  for (const c of claims) {
    const actions = Array.isArray(c.actions) ? c.actions : [];
    for (const a of actions) {
      if (!a.reminderAt) continue;
      const t = Date.parse(a.reminderAt);
      if (!Number.isFinite(t)) continue;
      if (t <= now) {
        rows.push({
          claimId: c.id,
          claimNumber: c.claimNumber,
          vesselName: c.extraction?.vesselName || c.vesselName || null,
          progressStatus: c.progressStatus,
          coverTypes: Array.isArray(c.covers) ? c.covers : [],
          actionId: a.id,
          actionTitle: a.title,
          ownerRole: a.ownerRole,
          reminderAt: a.reminderAt,
          dueAt: a.dueAt || null,
        });
      }
    }
  }

  // soonest reminder first
  rows.sort((x, y) => Date.parse(x.reminderAt) - Date.parse(y.reminderAt));
  return rows;
}

module.exports = {
  createClaim,
  listClaims,
  getClaim,
  patchProgress,
  patchFinance,
  patchAction,
  getDrafts,
  getDueReminders,
};
