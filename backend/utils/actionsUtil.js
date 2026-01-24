// backend/utils/actionsUtil.js
const { v4: uuidv4 } = require("uuid");

function isoNowPlusHours(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function buildAction(title, ownerRole, dueHoursFromNow) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(), // stable unique id, works fine for PATCH routes
    title,
    ownerRole,
    dueAt: isoNowPlusHours(dueHoursFromNow),
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
    reminderAt: null,
    notes: "",
  };
}

/**
 * Generates sensible default actions based on cover types.
 * We keep this conservative so it doesn't break anything else.
 */
function defaultActionsForClassification(classification = {}) {
  const covers = Array.isArray(classification?.covers)
    ? classification.covers.map((c) => c.type).filter(Boolean)
    : [];

  const actions = [];

  // Always
  actions.push(buildAction("Create claim file and preserve evidence", "Claims", 0));
  actions.push(buildAction("Confirm cover(s) and notify relevant insurers/club", "Claims", 0));
  actions.push(buildAction("Collect supporting documents (log extracts, photos, reports)", "Ops", 24));
  actions.push(buildAction("Appoint / confirm surveyor (if required)", "Claims", 24));
  actions.push(buildAction("Establish initial reserve (estimate) and deductible impact", "Finance", 48));
  actions.push(buildAction("Track updates and maintain status log", "Claims", 0));

  // P&I specific
  if (covers.includes("P&I")) {
    actions.push(buildAction("Identify third-party involvement and liability exposure", "Claims", 24));
    actions.push(buildAction("Obtain statements (Master/crew) and incident report", "Ops", 24));
    actions.push(buildAction("Notify correspondents / local agents if required", "Claims", 24));
  }

  // H&M specific
  if (covers.includes("H&M") || covers.includes("H&M (Hull)")) {
    actions.push(buildAction("Confirm class involvement and arrange class attendance (if required)", "Ops", 24));
    actions.push(buildAction("Collect repair estimates / yard quotation", "Ops", 72));
    actions.push(buildAction("Confirm H&M insurer notification and claims handling instructions", "Claims", 24));
  }

  // Cargo
  if (covers.includes("Cargo")) {
    actions.push(buildAction("Collect cargo documents (BL, mate’s receipt, tally, condition)", "Ops", 24));
    actions.push(buildAction("Mitigate loss and preserve damaged cargo evidence", "Ops", 0));
  }

  // Charterers Liability
  if (covers.includes("Charterers Liability")) {
    actions.push(buildAction("Extract CP clause highlights relevant to liability/indemnities", "Claims", 24));
    actions.push(buildAction("Notify charterers liability insurer/handlers with preliminary position", "Claims", 24));
  }

  return actions;
}

module.exports = {
  defaultActionsForClassification,
};
