// backend/controllers/claimsController.js

const claimService = require("../services/claimService");

function sendOk(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function sendErr(res, code, message, status = 400, extra = {}) {
  return res.status(status).json({ ok: false, error: code, message, ...extra });
}

async function createClaim(req, res) {
  try {
    const createdBy = req.body?.createdBy || "Unknown";
    const firstNotificationText = req.body?.firstNotificationText || "";

    if (!firstNotificationText.trim()) {
      return sendErr(res, "BadRequest", "firstNotificationText is required", 400);
    }

    const claim = await claimService.createClaim({
      createdBy,
      firstNotificationText,
    });

    // CRITICAL GUARD:
    // If service accidentally returns nothing, we fail loudly (not ok:true,data:{})
    if (!claim || !claim.id) {
      return sendErr(
        res,
        "CreateFailed",
        "Claim created but service returned empty claim object (missing id).",
        500,
        { debug: { returned: claim } }
      );
    }

    return sendOk(res, claim, 201);
  } catch (e) {
    return sendErr(res, "ServerError", e?.message || "Unknown error", 500);
  }
}

async function listClaims(req, res) {
  try {
    const rows = await claimService.listClaims();
    return sendOk(res, rows);
  } catch (e) {
    return sendErr(res, "ServerError", e?.message || "Unknown error", 500);
  }
}

async function getClaim(req, res) {
  try {
    const id = req.params?.id;
    if (!id) return sendErr(res, "BadRequest", "Missing claim id", 400);

    const claim = await claimService.getClaim(id);
    if (!claim) return sendErr(res, "NotFound", "Claim not found", 404);

    return sendOk(res, claim);
  } catch (e) {
    return sendErr(res, "ServerError", e?.message || "Unknown error", 500);
  }
}

async function patchProgress(req, res) {
  try {
    const id = req.params?.id;
    if (!id) return sendErr(res, "BadRequest", "Missing claim id", 400);

    const by = req.body?.by || "Unknown";
    const progressStatus = req.body?.progressStatus;
    if (!progressStatus) return sendErr(res, "BadRequest", "progressStatus is required", 400);

    const claim = await claimService.patchProgress({ id, by, progressStatus });
    if (!claim) return sendErr(res, "NotFound", "Claim not found", 404);

    return sendOk(res, claim);
  } catch (e) {
    return sendErr(res, "ServerError", e?.message || "Unknown error", 500);
  }
}

async function patchFinance(req, res) {
  try {
    const id = req.params?.id;
    if (!id) return sendErr(res, "BadRequest", "Missing claim id", 400);

    const by = req.body?.by || "Unknown";
    const finance = req.body?.finance || {};
    const claim = await claimService.patchFinance({ id, by, finance });
    if (!claim) return sendErr(res, "NotFound", "Claim not found", 404);

    return sendOk(res, claim);
  } catch (e) {
    return sendErr(res, "ServerError", e?.message || "Unknown error", 500);
  }
}

async function patchAction(req, res) {
  try {
    const id = req.params?.id;
    const actionId = req.params?.actionId;
    if (!id) return sendErr(res, "BadRequest", "Missing claim id", 400);
    if (!actionId) return sendErr(res, "BadRequest", "Missing action id", 400);

    const by = req.body?.by || "Unknown";
    const patch = req.body || {};

    const updated = await claimService.patchAction({ id, actionId, by, patch });
    if (!updated) return sendErr(res, "NotFound", "Claim or action not found", 404);

    return sendOk(res, updated);
  } catch (e) {
    return sendErr(res, "ServerError", e?.message || "Unknown error", 500);
  }
}

async function getDrafts(req, res) {
  try {
    const id = req.params?.id;
    if (!id) return sendErr(res, "BadRequest", "Missing claim id", 400);

    const drafts = await claimService.getDrafts(id);
    if (!drafts) return sendErr(res, "NotFound", "Claim not found", 404);

    return sendOk(res, drafts);
  } catch (e) {
    return sendErr(res, "ServerError", e?.message || "Unknown error", 500);
  }
}

async function getDueReminders(req, res) {
  try {
    const rows = await claimService.getDueReminders();
    return sendOk(res, rows);
  } catch (e) {
    return sendErr(res, "ServerError", e?.message || "Unknown error", 500);
  }
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
