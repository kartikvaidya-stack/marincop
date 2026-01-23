// backend/controllers/claimsController.js

const claimService = require("../services/claimService");

function ok(res, data) {
  return res.json({ ok: true, data });
}

function fail(res, status, error, message, extra = {}) {
  return res.status(status).json({ ok: false, error, message, ...extra });
}

// POST /api/claims
exports.createClaim = (req, res) => {
  try {
    const { createdBy, firstNotificationText } = req.body || {};
    if (!firstNotificationText) {
      return fail(res, 400, "BadRequest", "firstNotificationText is required");
    }
    const created = claimService.createClaim({ createdBy, firstNotificationText });
    return ok(res, created);
  } catch (e) {
    return fail(res, 500, "TypeError", e?.message || "Unknown error");
  }
};

// GET /api/claims
exports.listClaims = (req, res) => {
  try {
    const data = claimService.listClaims();
    return ok(res, data);
  } catch (e) {
    return fail(res, 500, "TypeError", e?.message || "Unknown error");
  }
};

// GET /api/claims/:id
exports.getClaim = (req, res) => {
  try {
    const id = req.params.id;
    const claim = claimService.getClaim(id);
    if (!claim) return fail(res, 404, "NotFound", "Claim not found");
    return ok(res, claim);
  } catch (e) {
    return fail(res, 500, "TypeError", e?.message || "Unknown error");
  }
};

// PATCH /api/claims/:id/progress
exports.patchProgress = (req, res) => {
  try {
    const id = req.params.id;
    const { by, progressStatus } = req.body || {};
    if (!by) return fail(res, 400, "BadRequest", "by is required");
    if (!progressStatus) return fail(res, 400, "BadRequest", "progressStatus is required");

    const updated = claimService.updateProgressStatus(id, { by, progressStatus });
    if (!updated) return fail(res, 404, "NotFound", "Claim not found");
    return ok(res, updated);
  } catch (e) {
    return fail(res, 500, "TypeError", e?.message || "Unknown error");
  }
};

// PATCH /api/claims/:id/finance
exports.patchFinance = (req, res) => {
  try {
    const id = req.params.id;

    // IMPORTANT: do not destructure fields here; pass the object through so "paid" is supported
    const by = req.body?.by;
    const finance = req.body?.finance;

    if (!by) return fail(res, 400, "BadRequest", "by is required");
    if (!finance) return fail(res, 400, "BadRequest", "finance object is required");

    const updated = claimService.updateFinance(id, finance, by);
    if (!updated) return fail(res, 404, "NotFound", "Claim not found");
    return ok(res, updated);
  } catch (e) {
    return fail(res, 500, "TypeError", e?.message || "Unknown error");
  }
};

// PATCH /api/claims/:id/actions/:actionId
exports.patchAction = (req, res) => {
  try {
    const id = req.params.id;
    const actionId = req.params.actionId;
    const { by, status, notes, reminderAt } = req.body || {};

    if (!by) return fail(res, 400, "BadRequest", "by is required");
    if (!status && !notes && typeof reminderAt === "undefined") {
      return fail(res, 400, "BadRequest", "Provide at least one of: status, notes, reminderAt");
    }

    const updated = claimService.updateAction(id, actionId, { by, status, notes, reminderAt });
    if (!updated) return fail(res, 404, "NotFound", "Claim not found");
    return ok(res, updated);
  } catch (e) {
    return fail(res, 500, "TypeError", e?.message || "Unknown error");
  }
};

// GET /api/claims/:id/drafts
exports.getDrafts = (req, res) => {
  try {
    const id = req.params.id;
    const drafts = claimService.getDrafts(id);
    if (!drafts) return fail(res, 404, "NotFound", "Claim not found");
    return ok(res, drafts);
  } catch (e) {
    return fail(res, 500, "TypeError", e?.message || "Unknown error");
  }
};

// GET /api/claims/reminders/due
exports.getDueReminders = (req, res) => {
  try {
    const data = claimService.getDueReminders();
    return ok(res, data);
  } catch (e) {
    return fail(res, 500, "TypeError", e?.message || "Unknown error");
  }
};
