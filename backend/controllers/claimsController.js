// backend/controllers/claimsController.js

const claimService = require("../services/claimService");
const remindersService = require("../services/remindersService");

// consistent error response
function sendErr(res, err, status = 500) {
  const message = err?.message || String(err);
  const code = err?.code || "ServerError";
  return res.status(status).json({ ok: false, error: code, message });
}

/**
 * POST /api/claims
 * Body: { createdBy, firstNotificationText }
 */
async function createClaim(req, res) {
  try {
    const body = req.body || {};
    const createdBy = body.createdBy || "Unknown";
    const firstNotificationText = body.firstNotificationText || "";

    if (!firstNotificationText || String(firstNotificationText).trim().length < 3) {
      return res.status(400).json({
        ok: false,
        error: "BadRequest",
        message: "firstNotificationText is required",
      });
    }

    const claim = await claimService.createClaim({
      createdBy,
      firstNotificationText,
    });

    return res.json({ ok: true, data: claim });
  } catch (err) {
    return sendErr(res, err);
  }
}

/**
 * GET /api/claims
 */
async function listClaims(req, res) {
  try {
    const claims = await claimService.listClaims();
    return res.json({ ok: true, data: claims });
  } catch (err) {
    return sendErr(res, err);
  }
}

/**
 * GET /api/claims/:id
 */
async function getClaim(req, res) {
  try {
    const id = req.params.id;
    const claim = await claimService.getClaim(id);
    if (!claim) {
      return res.status(404).json({ ok: false, error: "NotFound", message: "Claim not found" });
    }
    return res.json({ ok: true, data: claim });
  } catch (err) {
    return sendErr(res, err);
  }
}

/**
 * PATCH /api/claims/:id/progress
 * Body: { by, progressStatus }
 */
async function patchProgress(req, res) {
  try {
    const id = req.params.id;
    const body = req.body || {};

    const by = body.by || "System";
    const progressStatus = body.progressStatus;

    if (!progressStatus) {
      return res.status(400).json({
        ok: false,
        error: "BadRequest",
        message: "progressStatus is required",
      });
    }

    const updated = await claimService.patchProgress(id, { by, progressStatus });
    return res.json({ ok: true, data: updated });
  } catch (err) {
    return sendErr(res, err);
  }
}

/**
 * PATCH /api/claims/:id/finance
 * Body: { by, finance: { ... } }
 */
async function patchFinance(req, res) {
  try {
    const id = req.params.id;
    const body = req.body || {};

    const by = body.by || "System";
    const finance = body.finance;

    if (!finance || typeof finance !== "object") {
      return res.status(400).json({
        ok: false,
        error: "BadRequest",
        message: "finance object is required",
      });
    }

    const updated = await claimService.patchFinance(id, { by, finance });
    return res.json({ ok: true, data: updated });
  } catch (err) {
    return sendErr(res, err);
  }
}

/**
 * PATCH /api/claims/:id/actions/:actionId
 * Body: { by, status, notes, reminderAt }
 */
async function patchAction(req, res) {
  try {
    const id = req.params.id;
    const actionId = req.params.actionId;
    const body = req.body || {};

    const by = body.by || "System";

    const patch = {
      by,
      status: body.status,
      notes: body.notes,
      reminderAt: body.reminderAt,
    };

    const updatedAction = await claimService.patchAction(id, actionId, patch);
    return res.json({ ok: true, data: updatedAction });
  } catch (err) {
    return sendErr(res, err);
  }
}

/**
 * GET /api/claims/:id/drafts
 */
async function getDrafts(req, res) {
  try {
    const id = req.params.id;
    const drafts = await claimService.getDrafts(id);
    return res.json({ ok: true, data: drafts });
  } catch (err) {
    return sendErr(res, err);
  }
}

/**
 * GET /api/claims/reminders/due
 */
async function getDueReminders(req, res) {
  try {
    const daysAhead = Number(req.query.daysAhead ?? 14);
    const due = await remindersService.getDueReminders({ daysAhead });
    return res.json({ ok: true, data: due });
  } catch (err) {
    return sendErr(res, err);
  }
}

/**
 * GET /api/claims/reminders
 * For now: same output as "due" (safe + keeps UI working)
 */
async function getReminders(req, res) {
  return getDueReminders(req, res);
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
  getReminders,
};
