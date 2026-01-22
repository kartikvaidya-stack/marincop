// backend/controllers/claimsController.js

const claimService = require("../services/claimService");

/**
 * GET /api/claims
 */
async function listClaims(req, res) {
  try {
    const data = await claimService.listClaims();
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

/**
 * POST /api/claims
 */
async function createClaim(req, res) {
  try {
    const { createdBy, firstNotificationText } = req.body || {};
    const data = await claimService.createClaim({ createdBy, firstNotificationText });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    res.status(400).json({ ok: false, error: "BadRequest", message: err.message });
  }
}

/**
 * GET /api/claims/:id
 */
async function getClaim(req, res) {
  try {
    const { id } = req.params;
    const data = await claimService.getClaim(id);
    if (!data) return res.status(404).json({ ok: false, error: "NotFound", message: "Claim not found" });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

/**
 * PATCH /api/claims/:id/progress
 */
async function updateProgress(req, res) {
  try {
    const { id } = req.params;
    const { by, progressStatus } = req.body || {};
    const data = await claimService.updateProgress({ claimId: id, by, progressStatus });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(400).json({ ok: false, error: "BadRequest", message: err.message });
  }
}

/**
 * PATCH /api/claims/:id/finance
 */
async function updateFinance(req, res) {
  try {
    const { id } = req.params;
    const { by, finance } = req.body || {};
    const data = await claimService.updateFinance({ claimId: id, by, finance });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(400).json({ ok: false, error: "BadRequest", message: err.message });
  }
}

/**
 * PATCH /api/claims/:id/actions/:actionId
 */
async function updateAction(req, res) {
  try {
    const { id, actionId } = req.params;
    const { by, status, notes, reminderAt } = req.body || {};
    const data = await claimService.updateAction({
      claimId: id,
      actionId,
      by,
      status,
      notes,
      reminderAt,
    });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(400).json({ ok: false, error: "BadRequest", message: err.message });
  }
}

/**
 * GET /api/claims/reminders/due?before=ISO_DATE(optional)
 * Returns reminders that are OPEN and reminderAt <= before (default: now)
 */
async function getDueReminders(req, res) {
  try {
    const before = req.query.before ? new Date(req.query.before) : new Date();
    const data = await claimService.getDueReminders({ before });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(400).json({ ok: false, error: "BadRequest", message: err.message });
  }
}

/**
 * PATCH /api/claims/:id/actions/:actionId/reminder
 * body: { by, snoozeDays }
 */
async function snoozeActionReminder(req, res) {
  try {
    const { id, actionId } = req.params;
    const { by, snoozeDays } = req.body || {};
    const data = await claimService.snoozeActionReminder({
      claimId: id,
      actionId,
      by,
      snoozeDays,
    });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(400).json({ ok: false, error: "BadRequest", message: err.message });
  }
}

module.exports = {
  listClaims,
  createClaim,
  getClaim,
  updateProgress,
  updateFinance,
  updateAction,
  getDueReminders,
  snoozeActionReminder,
};
