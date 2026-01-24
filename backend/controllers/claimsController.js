// backend/controllers/claimsController.js
const claimService = require("../services/claimService");

function ok(res, data) {
  return res.json({ ok: true, data });
}

function fail(res, status, error, message, extra = {}) {
  return res.status(status).json({ ok: false, error, message, ...extra });
}

async function listClaims(req, res) {
  try {
    const data = claimService.listClaims();
    return ok(res, data);
  } catch (e) {
    return fail(res, 500, "ServerError", e.message || "Failed to list claims");
  }
}

async function createClaim(req, res) {
  try {
    const { createdBy, company, firstNotificationText } = req.body || {};
    if (!firstNotificationText) return fail(res, 400, "BadRequest", "firstNotificationText is required");
    const data = claimService.createClaim({ createdBy, company, firstNotificationText });
    return ok(res, data);
  } catch (e) {
    return fail(res, 500, "ServerError", e.message || "Failed to create claim");
  }
}

async function getClaim(req, res) {
  try {
    const id = req.params.id;
    const data = claimService.getClaim(id);
    if (!data) return fail(res, 404, "NotFound", "Claim not found");
    return ok(res, data);
  } catch (e) {
    return fail(res, 500, "ServerError", e.message || "Failed to load claim");
  }
}

async function patchProgress(req, res) {
  try {
    const id = req.params.id;
    const { by, progressStatus } = req.body || {};
    if (!progressStatus) return fail(res, 400, "BadRequest", "progressStatus is required");

    const data = claimService.patchProgress({ id, by, progressStatus });
    if (!data) return fail(res, 404, "NotFound", "Claim not found");
    return ok(res, { id, progressStatus: data.progressStatus });
  } catch (e) {
    return fail(res, 500, "ServerError", e.message || "Failed to patch progress");
  }
}

async function patchFinance(req, res) {
  try {
    const id = req.params.id;
    const { by, finance } = req.body || {};
    if (!finance) return fail(res, 400, "BadRequest", "finance object is required");

    const data = claimService.patchFinance({ id, by, finance });
    if (!data) return fail(res, 404, "NotFound", "Claim not found");
    return ok(res, data);
  } catch (e) {
    return fail(res, 500, "ServerError", e.message || "Failed to patch finance");
  }
}

async function patchAction(req, res) {
  try {
    const id = req.params.id;
    const actionId = req.params.actionId;

    const { by, status, notes, reminderAt } = req.body || {};
    const data = claimService.patchAction({ id, actionId, by, status, notes, reminderAt });

    if (!data) return fail(res, 404, "NotFound", "Claim/action not found");
    return ok(res, data);
  } catch (e) {
    return fail(res, 500, "ServerError", e.message || "Failed to patch action");
  }
}

async function getDrafts(req, res) {
  try {
    const id = req.params.id;
    const data = claimService.getDrafts(id);
    if (!data) return fail(res, 404, "NotFound", "Claim not found");
    return ok(res, data);
  } catch (e) {
    return fail(res, 500, "ServerError", e.message || "Failed to get drafts");
  }
}

async function getDueReminders(req, res) {
  try {
    const data = claimService.getDueReminders();
    return ok(res, data);
  } catch (e) {
    return fail(res, 500, "ServerError", e.message || "Failed to load reminders");
  }
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
};
