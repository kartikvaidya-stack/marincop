// backend/services/claimService.js
// Self-contained claim service backed by JSON file storage.
// Restores full draft templates and ensures drafts never return null.

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DB_PATH = path.join(__dirname, "../../database/data/claims.json");

function nowIso() {
  return new Date().toISOString();
}

function safeParseJson(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function readClaims() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2), "utf8");
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const data = safeParseJson(raw, []);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    // If file corrupt, don't crash server
    return [];
  }
}

function writeClaims(claims) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(claims, null, 2), "utf8");
}

function ensureArrays(claim) {
  if (!claim.statusLog || !Array.isArray(claim.statusLog)) claim.statusLog = [];
  if (!claim.auditTrail || !Array.isArray(claim.auditTrail)) claim.auditTrail = [];
  if (!claim.actions || !Array.isArray(claim.actions)) claim.actions = [];
  if (!claim.files || !Array.isArray(claim.files)) claim.files = [];
  if (!claim.finance || typeof claim.finance !== "object" || claim.finance === null) {
    claim.finance = {};
  }
  return claim;
}

function computeFinance(fin) {
  const currency = fin.currency || "USD";

  const reserveEstimated = Number(fin.reserveEstimated || 0);
  // cashOut is the owner's cash paid out (can increase)
  // accept legacy "paid" too
  const cashOut = Number(fin.cashOut ?? fin.paid ?? 0);
  const paid = cashOut; // keep legacy alias
  const deductible = Number(fin.deductible || 0);

  // recoverableExpected = paid/cashOut minus deductible (never < 0)
  const recoverableExpected = Number(fin.recoverableExpected ?? Math.max(0, cashOut - deductible));

  // recovered = actual recovery received from insurers/third parties
  const recovered = Number(fin.recovered || 0);

  // outstandingRecovery = remaining to recover
  const outstandingRecovery = Number(fin.outstandingRecovery ?? Math.max(0, recoverableExpected - recovered));

  // legacy aliases
  const recoverable = recoverableExpected;
  const outstanding = outstandingRecovery;

  return {
    currency,
    reserveEstimated,
    cashOut,
    paid,
    deductible,
    recoverableExpected,
    recoverable,
    recovered,
    outstandingRecovery,
    outstanding,
    notes: fin.notes || "",
  };
}

function nextClaimNumber(claims, company = "Nova Carriers") {
  // MC-NOVA-YYYY-0001
  const year = new Date().getFullYear();
  const prefix = "MC-NOVA";
  const sameYear = claims
    .map((c) => c.claimNumber)
    .filter((n) => typeof n === "string" && n.startsWith(`${prefix}-${year}-`));

  let max = 0;
  for (const n of sameYear) {
    const parts = n.split("-");
    const seq = Number(parts[parts.length - 1]);
    if (!Number.isNaN(seq)) max = Math.max(max, seq);
  }
  const next = String(max + 1).padStart(4, "0");
  return `${prefix}-${year}-${next}`;
}

function extractBasics(rawText) {
  const text = (rawText || "").toString();

  // Vessel name: common patterns
  // 1) Vessel: MV XXX
  // 2) M/V XXX or MV XXX at start of a line
  let vesselName = null;

  const m1 = text.match(/^\s*Vessel\s*:\s*(.+)\s*$/im);
  if (m1 && m1[1]) vesselName = m1[1].trim();

  if (!vesselName) {
    const m2 = text.match(/^\s*(M\/V|MV|MT)\s+([A-Z0-9][A-Z0-9 \-']{2,})\s*$/im);
    if (m2 && m2[0]) vesselName = m2[0].trim();
  }

  // IMO
  let imo = null;
  const imoM = text.match(/\bIMO\s*:\s*([0-9]{7})\b/i);
  if (imoM) imo = imoM[1];

  // Date text (very lightweight)
  let eventDateText = null;
  const dateM = text.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/);
  if (dateM) eventDateText = dateM[1];

  // Location / position
  let locationText = null;
  const posM = text.match(/^\s*(Position|Location)\s*:\s*(.+)\s*$/im);
  if (posM && posM[2]) locationText = posM[2].trim();

  // Keywords for quick classification
  const lower = text.toLowerCase();
  const incidentKeywords = [];
  const kw = [
    "collision",
    "contact",
    "grounding",
    "fire",
    "explosion",
    "pollution",
    "spill",
    "injury",
    "death",
    "cargo damage",
    "shortage",
    "wet damage",
    "pilot",
    "stevedore",
    "berth",
    "quay",
    "crane",
    "charter",
    "chartered",
    "time charter",
    "voyage charter",
  ];
  for (const k of kw) {
    if (lower.includes(k)) incidentKeywords.push(k);
  }

  return {
    rawText: text,
    summary: text,
    vesselName,
    imo,
    eventDateText,
    locationText,
    incidentKeywords,
    counterpartyText: null,
  };
}

function classifyFromText(rawText) {
  const t = (rawText || "").toLowerCase();
  const covers = [];
  const pushCover = (type, confidence, reasoning) => covers.push({ type, confidence, reasoning });

  // CRITICAL MARINE INSURANCE RULE:
  // If Nova Carriers is a CHARTERER => ONLY Charterers Liability applies
  // H&M (Hull & Machinery) is for vessel OWNERS, not charterers
  const isCharterer = t.includes("chartered") || t.includes("charterers") || 
                      t.includes("time charter") || t.includes("voyage charter") ||
                      t.includes("as charterer") || t.includes("we chartered");

  if (isCharterer) {
    pushCover("Charterers Liability", 0.85,
      "Charterer involvement CONFIRMED. Charterers Liability is PRIMARY cover (H&M does NOT apply to charterers).");
  }

  // P&I indicators (third-party liabilities - applies regardless of role)
  if (t.includes("pollution") || t.includes("spill") || t.includes("injury") || t.includes("death") ||
      t.includes("contact") || t.includes("collision") || t.includes("berth") || t.includes("quay") ||
      t.includes("pilot") || t.includes("stevedore")) {
    pushCover("P&I", 0.85, "Third-party liabilities detected (collision, pollution, injury, etc.).");
  }

  // H&M indicators (physical ship damage) - ONLY suggest if NOT a charterer
  if (!isCharterer && (t.includes("damage to hull") || t.includes("denting") || t.includes("shell plating") ||
      t.includes("rudder") || t.includes("propeller") || t.includes("machinery") || t.includes("engine") ||
      t.includes("grounding") || t.includes("fire") || t.includes("flooding"))) {
    pushCover("H&M", 0.78, "Physical damage to vessel/machinery. Hull & Machinery applies to owners (not charterers).");
  }

  // Cargo indicators (applies to any role)
  if (t.includes("cargo") || t.includes("shortage") || t.includes("wet damage") ||
      t.includes("contamination") || t.includes("hold fire") || t.includes("damage to cargo")) {
    pushCover("Cargo", 0.72, "Cargo loss/damage indicated.");
  }

  if (covers.length === 0) {
    pushCover("To Be Confirmed", 0.5, "Insufficient information to classify; requires further details.");
  }

  // Ensure unique types (avoid duplicates)
  const seen = new Set();
  const unique = [];
  for (const c of covers) {
    if (!seen.has(c.type)) {
      unique.push(c);
      seen.add(c.type);
    }
  }
  return { covers: unique };
}

function generateIncidentSpecificActions(claimId, createdAtIso, extraction = {}) {
  const base = (n, title, ownerRole, daysDue = 0) => {
    const due = new Date(createdAtIso);
    due.setDate(due.getDate() + daysDue);
    const dueAt = due.toISOString();
    return {
      id: `${claimId}-A${n}`,
      title,
      ownerRole,
      dueAt,
      status: "OPEN",
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
      reminderAt: null,
      notes: "",
    };
  };

  const actions = [];
  
  // Base actions (always included)
  actions.push(base(1, "Create claim file and preserve evidence", "Claims", 0));
  actions.push(base(2, "Confirm cover(s) and notify relevant insurers/club", "Claims", 0));
  actions.push(base(3, "Collect supporting documents (log extracts, photos, reports)", "Ops", 1));
  actions.push(base(5, "Establish initial reserve / cash-out and deductible impact", "Finance", 2));
  actions.push(base(6, "Track updates and maintain status log", "Claims", 0));

  // Incident-specific actions based on incident type
  const incidentType = (extraction?.incidentType || "").toLowerCase();
  const keywords = (extraction?.incidentKeywords || []).map(k => k.toLowerCase());
  
  let actionCounter = 10;
  
  if (incidentType.includes("fire") || incidentType.includes("explosion") || 
      keywords.some(k => k.includes("fire") || k.includes("explosion"))) {
    actions.push(base(actionCounter++, "Obtain fire investigation report and damage assessment", "Ops", 2));
    actions.push(base(actionCounter++, "Confirm vessel class/flag requirements for repairs", "Technical", 1));
    actions.push(base(actionCounter++, "Arrange temporary repairs if vessel needs to proceed", "Technical", 2));
  }
  
  if (incidentType.includes("collision") || incidentType.includes("contact") ||
      keywords.some(k => k.includes("collision") || k.includes("contact"))) {
    actions.push(base(actionCounter++, "Identify third-party vessel and establish liability", "Claims", 1));
    actions.push(base(actionCounter++, "Obtain Master's statement, crew interviews, and incident report", "Ops", 1));
    actions.push(base(actionCounter++, "Obtain AIS/Radar data and witness statements", "Ops", 2));
    actions.push(base(actionCounter++, "Notify P&I club and coordinate third-party recovery", "Claims", 0));
  }
  
  if (incidentType.includes("grounding") || keywords.some(k => k.includes("grounding"))) {
    actions.push(base(actionCounter++, "Confirm vessel refloating plan and salvage requirements", "Technical", 1));
    actions.push(base(actionCounter++, "Obtain hydrographic survey and environmental compliance report", "Ops", 2));
    actions.push(base(actionCounter++, "Arrange master's statement on navigation/weather conditions", "Ops", 1));
  }
  
  if (incidentType.includes("pollution") || incidentType.includes("spill") ||
      keywords.some(k => k.includes("pollution") || k.includes("spill"))) {
    actions.push(base(actionCounter++, "Report to authorities and environmental agencies if required", "Claims", 0));
    actions.push(base(actionCounter++, "Arrange pollution control measures and cleanup contractors", "Ops", 1));
    actions.push(base(actionCounter++, "Obtain environmental impact assessment and remediation costs", "Finance", 3));
  }
  
  if (incidentType.includes("machinery") || incidentType.includes("engine") ||
      keywords.some(k => k.includes("machinery") || k.includes("engine"))) {
    actions.push(base(actionCounter++, "Obtain repair quotations from qualified marine engineers", "Technical", 2));
    actions.push(base(actionCounter++, "Confirm main engine/propulsion unit damage and repair timeline", "Technical", 1));
    actions.push(base(actionCounter++, "Arrange spare parts sourcing if drydock required", "Technical", 2));
  }
  
  if (incidentType.includes("injury") || incidentType.includes("fatality") ||
      keywords.some(k => k.includes("injury") || k.includes("fatality"))) {
    actions.push(base(actionCounter++, "Obtain medical report and crew injury details", "Ops", 0));
    actions.push(base(actionCounter++, "Arrange legal counsel for accident investigation", "Claims", 1));
    actions.push(base(actionCounter++, "Notify flag state and relevant maritime authorities", "Claims", 1));
  }
  
  if (incidentType.includes("cargo") || keywords.some(k => k.includes("cargo"))) {
    actions.push(base(actionCounter++, "Obtain cargo survey report and shipper contact details", "Ops", 1));
    actions.push(base(actionCounter++, "Arrange cargo inspection and quantify loss/damage", "Ops", 2));
  }

  // P&I/Third-party specific actions
  if (keywords.some(k => k.includes("contact") || k.includes("collision") || k.includes("pollution"))) {
    actions.push(base(actionCounter++, "Identify third-party involvement and liability exposure", "Claims", 1));
    actions.push(base(actionCounter++, "Notify relevant correspondents / local agents", "Claims", 1));
  }

  return actions;
}

function defaultActions(claimId, createdAtIso) {
  // For backward compatibility, use generic actions
  return generateIncidentSpecificActions(claimId, createdAtIso, {});
}

// ---------- Public API expected by controllers ----------

function listClaims() {
  const claims = readClaims().map(ensureArrays);
  // Summaries used by dashboard
  return claims.map((c) => {
    const fin = computeFinance(c.finance || {});
    return {
      id: c.id,
      claimNumber: c.claimNumber,
      vesselName: c.vesselName ?? c.extraction?.vesselName ?? null,
      eventDateText: c.eventDateText ?? c.extraction?.eventDateText ?? null,
      locationText: c.locationText ?? c.extraction?.locationText ?? null,
      progressStatus: c.progressStatus || "Notification Received",
      covers: Array.isArray(c.covers) ? c.covers : (c.classification?.covers || []).map((x) => x.type),
      currency: fin.currency,
      reserveEstimated: fin.reserveEstimated,
      cashOut: fin.cashOut,
      paid: fin.paid,
      deductible: fin.deductible,
      recoverableExpected: fin.recoverableExpected,
      recovered: fin.recovered,
      outstandingRecovery: fin.outstandingRecovery,
      // legacy
      recoverable: fin.recoverable,
      outstanding: fin.outstanding,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  });
}

function createClaim({ createdBy, company, firstNotificationText }) {
  const claims = readClaims().map(ensureArrays);

  const id = randomUUID();
  const createdAt = nowIso();
  const claimNumber = nextClaimNumber(claims, company);

  const extraction = extractBasics(firstNotificationText);
  const classification = classifyFromText(firstNotificationText);
  const covers = classification.covers.map((c) => c.type);

  const fin = computeFinance({ currency: "USD" });

  const claim = ensureArrays({
    id,
    claimNumber,
    company: company || "Nova Carriers",
    createdAt,
    createdBy: createdBy || "Unknown",
    updatedAt: createdAt,
    progressStatus: "Notification Received",
    extraction,
    classification,
    vesselName: extraction.vesselName,
    eventDateText: extraction.eventDateText,
    locationText: extraction.locationText,
    covers,
    actions: generateIncidentSpecificActions(id, createdAt, extraction),
    finance: fin,
    files: [],
    statusLog: [
      { at: createdAt, by: createdBy || "Unknown", status: "Notification Received", note: "Claim created from first notification." },
    ],
    auditTrail: [
      { at: createdAt, by: createdBy || "Unknown", action: "CLAIM_CREATED", note: "Claim created from first notification text." },
    ],
  });

  claims.unshift(claim);
  writeClaims(claims);
  return claim;
}

function getClaim(id) {
  const claims = readClaims().map(ensureArrays);
  const c = claims.find((x) => x.id === id);
  if (!c) return null;

  // Recompute finance on the fly to keep fields consistent
  c.finance = computeFinance(c.finance || {});
  return c;
}

function patchProgress(id, { by, progressStatus }) {
  const claims = readClaims().map(ensureArrays);
  const idx = claims.findIndex((x) => x.id === id);
  if (idx < 0) return null;

  const c = ensureArrays(claims[idx]);
  const at = nowIso();
  c.progressStatus = progressStatus || c.progressStatus;
  c.updatedAt = at;

  c.statusLog.push({ at, by: by || "Unknown", status: c.progressStatus, note: "Progress updated" });
  c.auditTrail.push({ at, by: by || "Unknown", action: "STATUS_UPDATED", note: `Progress set to: ${c.progressStatus}` });

  claims[idx] = c;
  writeClaims(claims);
  return c;
}

function patchFinance(id, { by, finance }) {
  const claims = readClaims().map(ensureArrays);
  const idx = claims.findIndex((x) => x.id === id);
  if (idx < 0) return null;

  const c = ensureArrays(claims[idx]);
  const at = nowIso();

  const merged = { ...(c.finance || {}), ...(finance || {}) };
  
  // CRITICAL FIX: Don't preserve old recoverableExpected/outstandingRecovery
  // when cashOut/deductible/recovered change. Force recalculation.
  if (finance && (finance.cashOut !== undefined || finance.deductible !== undefined || finance.recovered !== undefined)) {
    delete merged.recoverableExpected;
    delete merged.outstandingRecovery;
  }
  
  c.finance = computeFinance(merged);

  // Keep top-level shortcuts aligned
  c.updatedAt = at;

  c.auditTrail.push({
    at,
    by: by || "Unknown",
    action: "FINANCE_UPDATED",
    note: `Finance updated (reserve=${c.finance.reserveEstimated}, cashOut=${c.finance.cashOut}, recovered=${c.finance.recovered}, outstandingRecovery=${c.finance.outstandingRecovery})`,
  });

  claims[idx] = c;
  writeClaims(claims);
  return c;
}

function patchAction(id, actionId, { by, status, notes, reminderAt }) {
  const claims = readClaims().map(ensureArrays);
  const idx = claims.findIndex((x) => x.id === id);
  if (idx < 0) return null;

  const c = ensureArrays(claims[idx]);
  const at = nowIso();

  const aIdx = c.actions.findIndex((a) => a.id === actionId);
  if (aIdx < 0) return null;

  const action = { ...c.actions[aIdx] };
  if (status) action.status = status;
  if (typeof notes === "string") action.notes = notes;
  if (typeof reminderAt === "string") action.reminderAt = reminderAt;
  action.updatedAt = at;

  c.actions[aIdx] = action;
  c.updatedAt = at;

  c.auditTrail.push({
    at,
    by: by || "Unknown",
    action: "ACTION_UPDATED",
    note: `Action updated: ${action.title} (status=${action.status}${action.reminderAt ? ", reminderAt set" : ""})`,
  });

  claims[idx] = c;
  writeClaims(claims);
  return action;
}

function getDrafts(id) {
  const claim = getClaim(id);
  if (!claim) return [];

  const vessel = claim.vesselName || claim.extraction?.vesselName || "Vessel";
  const imo = claim.extraction?.imo ? ` (IMO ${claim.extraction.imo})` : "";
  const when = claim.extraction?.eventDateText || "Date TBC";
  const where = claim.extraction?.locationText || "Location TBC";
  const claimNo = claim.claimNumber || id;

  const raw = claim.extraction?.rawText || "";
  const covers = Array.isArray(claim.covers) && claim.covers.length ? claim.covers.join(", ") : "To Be Confirmed";
  const fin = computeFinance(claim.finance || {});
  const company = claim.company || "Nova Carriers";

  // IMPORTANT: always return an ARRAY (never null)
  const drafts = [
    {
      type: "P&I_NOTIFICATION",
      subject: `[${claimNo}] - ${vessel} - P&I Notification (Initial)`,
      body:
        `Dear P&I Club / Correspondents,\n\n` +
        `We hereby give initial notification of an incident that may give rise to liabilities and/or costs falling within P&I cover.\n\n` +
        `Claim Ref: ${claimNo}\n` +
        `Vessel: ${vessel}${imo}\n` +
        `Date/Time (as advised): ${when}\n` +
        `Location/Position: ${where}\n` +
        `Cover indication: ${covers}\n\n` +
        `Initial description (as received):\n` +
        `${raw}\n\n` +
        `Immediate actions taken / proposed:\n` +
        `- Evidence preservation initiated (photos, statements, log extracts)\n` +
        `- Request guidance on next steps and appointment of surveyor (if required)\n` +
        `- Please advise any specific reporting format / documents required\n\n` +
        `Kindly acknowledge receipt and advise recommended course of action, including any correspondent/surveyor nomination.\n\n` +
        `Best regards,\n${company}\n(Claims Team)`
    },
    {
      type: "H&M_NOTIFICATION",
      subject: `[${claimNo}] - ${vessel} - H&M Notification (Initial)`,
      body:
        `Dear Hull Underwriters / Brokers,\n\n` +
        `We give notice of an occurrence which may give rise to a claim under the Hull & Machinery policy.\n\n` +
        `Claim Ref: ${claimNo}\n` +
        `Vessel: ${vessel}${imo}\n` +
        `Date/Time (as advised): ${when}\n` +
        `Location/Position: ${where}\n\n` +
        `Initial description (as received):\n${raw}\n\n` +
        `Please advise if surveyor appointment is required and any immediate actions under the policy conditions.\n\n` +
        `Best regards,\n${company}\n(Claims Team)`
    },
    {
      type: "SURVEYOR_APPOINTMENT",
      subject: `[${claimNo}] - ${vessel} - Survey Appointment Request`,
      body:
        `Dear Sir/Madam,\n\n` +
        `${company} requests your attendance / appointment as surveyor in relation to the below incident.\n\n` +
        `Claim Ref: ${claimNo}\n` +
        `Vessel: ${vessel}${imo}\n` +
        `Incident date: ${when}\n` +
        `Location: ${where}\n\n` +
        `Please confirm:\n` +
        `1) Earliest attendance and ETA\n` +
        `2) Information/documents required prior attendance\n` +
        `3) Expected deliverables and timeline for preliminary and final report\n\n` +
        `We will provide photographs, statements, and relevant extracts upon confirmation.\n\n` +
        `Best regards,\n${company}\n(Claims Team)`
    },
    {
      type: "EVIDENCE_REQUEST_VESSEL",
      subject: `[${claimNo}] - ${vessel} - Evidence / Documents Required`,
      body:
        `Master / Vessel Team,\n\n` +
        `For Claim Ref: ${claimNo}, please provide the following at the earliest:\n\n` +
        `- Statement of Facts / Master’s report and timeline\n` +
        `- Deck log extracts and engine log extracts (relevant period)\n` +
        `- VDR/S-VDR data preservation confirmation (if applicable)\n` +
        `- Photographs/videos of damage and relevant area(s)\n` +
        `- Pilot card, pilot details, tug details (if used)\n` +
        `- Any port/terminal reports or correspondence\n\n` +
        `Please confirm whether any third-party property was damaged and whether any pollution occurred.\n\n` +
        `Regards,\n${company}\n(Claims Team)`
    },
    {
      type: "INTERNAL_FINANCE_NOTE",
      subject: `[${claimNo}] - ${vessel} - Finance Snapshot / Reserve & Cash-Out`,
      body:
        `Internal Finance Note\n\n` +
        `Claim Ref: ${claimNo}\nVessel: ${vessel}\nCover(s): ${covers}\n\n` +
        `Reserve (insurer view): ${fin.currency} ${fin.reserveEstimated}\n` +
        `Owner cash-out paid: ${fin.currency} ${fin.cashOut}\n` +
        `Deductible: ${fin.currency} ${fin.deductible}\n` +
        `Expected recoverable: ${fin.currency} ${fin.recoverableExpected}\n` +
        `Recovered to date: ${fin.currency} ${fin.recovered}\n` +
        `Outstanding recovery: ${fin.currency} ${fin.outstandingRecovery}\n\n` +
        `Notes:\n${fin.notes || "-"}\n`
    },
    {
      type: "CHASE_REMINDER",
      subject: `[${claimNo}] - ${vessel} - Follow-up / Chase`,
      body:
        `Dear All,\n\n` +
        `Gentle reminder / follow-up in relation to Claim Ref ${claimNo} (${vessel}).\n\n` +
        `Pending item(s):\n- [Insert pending item / report]\n\n` +
        `Kindly provide an update and expected timeline for closure.\n\n` +
        `Best regards,\n${company}\n(Claims Team)`
    }
  ];

  return drafts;
}

function getDueReminders() {
  const claims = readClaims().map(ensureArrays);
  const now = Date.now();

  const due = [];
  for (const c of claims) {
    const coverTypes =
      Array.isArray(c.covers) ? c.covers : (c.classification?.covers || []).map((x) => x.type);

    for (const a of c.actions || []) {
      if (a && a.status !== "DONE" && a.reminderAt) {
        const t = new Date(a.reminderAt).getTime();
        if (!Number.isNaN(t) && t <= now) {
          due.push({
            claimId: c.id,
            claimNumber: c.claimNumber,
            vesselName: c.vesselName || c.extraction?.vesselName || null,
            progressStatus: c.progressStatus,
            coverTypes,
            actionId: a.id,
            actionTitle: a.title,
            ownerRole: a.ownerRole,
            reminderAt: a.reminderAt,
            dueAt: a.dueAt,
          });
        }
      }
    }
  }

  // sort soonest reminder first
  due.sort((x, y) => new Date(x.reminderAt) - new Date(y.reminderAt));
  return due;
}

function getReminders() {
  // “Upcoming” view: anything with reminderAt set and OPEN (done or not)
  const claims = readClaims().map(ensureArrays);

  const rows = [];
  for (const c of claims) {
    const coverTypes =
      Array.isArray(c.covers) ? c.covers : (c.classification?.covers || []).map((x) => x.type);

    for (const a of c.actions || []) {
      if (a && a.reminderAt) {
        rows.push({
          claimId: c.id,
          claimNumber: c.claimNumber,
          vesselName: c.vesselName || c.extraction?.vesselName || null,
          progressStatus: c.progressStatus,
          coverTypes,
          actionId: a.id,
          actionTitle: a.title,
          ownerRole: a.ownerRole,
          reminderAt: a.reminderAt,
          dueAt: a.dueAt,
          status: a.status,
        });
      }
    }
  }

  rows.sort((x, y) => new Date(x.reminderAt) - new Date(y.reminderAt));
  return rows;
}

module.exports = {
  listClaims,
  createClaim,
  getClaim,
  patchProgress,
  patchFinance,
  patchAction,
  getDrafts,
  getDueReminders,
  getReminders,
};
