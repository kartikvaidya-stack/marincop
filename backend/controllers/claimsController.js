// backend/controllers/claimsController.js

const claimService = require("../services/claimService");

function bodyOrEmpty(req) {
  return (req && req.body && typeof req.body === "object") ? req.body : {};
}

function sendNotFound(res, msg) {
  return res.status(404).json({ ok: false, error: "NotFound", message: msg || "Not found" });
}

function sendBadRequest(res, msg) {
  return res.status(400).json({ ok: false, error: "BadRequest", message: msg || "Bad request" });
}

async function createClaim(req, res) {
  try {
    const b = bodyOrEmpty(req);
    const createdBy = b.createdBy || "System";
    const firstNotificationText = b.firstNotificationText || "";

    if (!firstNotificationText.trim()) {
      return sendBadRequest(res, "firstNotificationText is required.");
    }

    const claim = await claimService.createClaim({
      company: "Nova Carriers",
      createdBy,
      firstNotificationText,
    });

    return res.json({ ok: true, data: claim });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "ServerError", message: e?.message || String(e) });
  }
}

function listClaims(req, res) {
  try {
    const data = claimService.getClaims ? claimService.getClaims() : claimService.listClaims();
    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "ServerError", message: e?.message || String(e) });
  }
}

function getClaim(req, res) {
  try {
    const id = req.params.id;
    if (!id) return sendBadRequest(res, "Missing claim id.");

    const claim = claimService.getClaim ? claimService.getClaim(id) : claimService.getClaimById(id);
    if (!claim) return sendNotFound(res, "Claim not found");

    return res.json({ ok: true, data: claim });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "ServerError", message: e?.message || String(e) });
  }
}

function patchProgress(req, res) {
  try {
    const id = req.params.id;
    if (!id) return sendBadRequest(res, "Missing claim id.");

    const b = bodyOrEmpty(req);
    const by = b.by || "System";
    const progressStatus = b.progressStatus || "";

    if (!progressStatus.trim()) {
      return sendBadRequest(res, "progressStatus is required.");
    }

    const updated = claimService.patchProgress
      ? claimService.patchProgress(id, { by, progressStatus })
      : claimService.updateProgress(id, { by, progressStatus });

    if (!updated) return sendNotFound(res, "Claim not found");

    return res.json({ ok: true, data: updated });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "ServerError", message: e?.message || String(e) });
  }
}

function patchFinance(req, res) {
  try {
    const id = req.params.id;
    if (!id) return sendBadRequest(res, "Missing claim id.");

    const b = bodyOrEmpty(req);
    const by = b.by || "System";
    const finance = (b.finance && typeof b.finance === "object") ? b.finance : {};

    const updated = claimService.patchFinance
      ? claimService.patchFinance(id, { by, finance })
      : claimService.updateFinance(id, { by, finance });

    if (!updated) return sendNotFound(res, "Claim not found");

    return res.json({ ok: true, data: updated });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "ServerError", message: e?.message || String(e) });
  }
}

function patchAction(req, res) {
  try {
    const id = req.params.id;
    const actionId = req.params.actionId;

    if (!id) return sendBadRequest(res, "Missing claim id.");
    if (!actionId) return sendBadRequest(res, "Missing action id.");

    const b = bodyOrEmpty(req);
    const by = b.by || "System";

    const updated = claimService.patchAction
      ? claimService.patchAction(id, actionId, {
          by,
          status: b.status,
          notes: b.notes,
          reminderAt: b.reminderAt,
        })
      : claimService.updateAction(id, actionId, {
          by,
          status: b.status,
          notes: b.notes,
          reminderAt: b.reminderAt,
        });

    if (!updated) return sendNotFound(res, "Claim or action not found");

    // Some routes return action only; we return updated claim (more useful)
    return res.json({ ok: true, data: updated });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "ServerError", message: e?.message || String(e) });
  }
}

function getDrafts(req, res) {
  try {
    const id = req.params.id;
    if (!id) return sendBadRequest(res, "Missing claim id.");

    const drafts = claimService.getDrafts
      ? claimService.getDrafts(id)
      : claimService.generateDraftTemplates(id);

    if (!drafts) return sendNotFound(res, "Claim not found");

    return res.json({ ok: true, data: drafts });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "ServerError", message: e?.message || String(e) });
  }
}

function getDueReminders(req, res) {
  try {
    const data = claimService.getRemindersDue
      ? claimService.getRemindersDue()
      : claimService.getDueReminders();

    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "ServerError", message: e?.message || String(e) });
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
