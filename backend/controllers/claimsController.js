// backend/controllers/claimsController.js
const claimService = require("../services/claimService");
const remindersService = require("../services/remindersService");

async function createClaim(req, res) {
  try {
    const data = await claimService.createClaim(req.body || {});
    return res.status(201).json({ ok: true, data });
  } catch (err) {
    console.error("createClaim error:", err);
    return res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

async function listClaims(req, res) {
  try {
    const data = await claimService.listClaims();
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("listClaims error:", err);
    return res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

async function getClaim(req, res) {
  try {
    const { id } = req.params;
    const data = await claimService.getClaim(id);
    if (!data) return res.status(404).json({ ok: false, error: "NotFound", message: "Claim not found" });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("getClaim error:", err);
    return res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

async function patchProgress(req, res) {
  try {
    const { id } = req.params;
    const data = await claimService.patchProgress(id, req.body || {});
    if (!data) return res.status(404).json({ ok: false, error: "NotFound", message: "Claim not found" });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("patchProgress error:", err);
    return res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

async function patchFinance(req, res) {
  try {
    const { id } = req.params;
    const data = await claimService.patchFinance(id, req.body || {});
    if (!data) return res.status(404).json({ ok: false, error: "NotFound", message: "Claim not found" });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("patchFinance error:", err);
    return res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

async function patchAction(req, res) {
  try {
    const { id, actionId } = req.params;
    const data = await claimService.patchAction(id, actionId, req.body || {});
    if (!data) return res.status(404).json({ ok: false, error: "NotFound", message: "Claim or action not found" });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("patchAction error:", err);
    return res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

async function getDrafts(req, res) {
  try {
    const { id } = req.params;
    const data = await claimService.getDrafts(id);
    if (!data) return res.status(404).json({ ok: false, error: "NotFound", message: "Claim not found" });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("getDrafts error:", err);
    return res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

// Existing "due" endpoint — keep it unchanged
async function getDueReminders(req, res) {
  try {
    const data = await claimService.getDueReminders();
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("getDueReminders error:", err);
    return res.status(500).json({ ok: false, error: "ServerError", message: err.message });
  }
}

// ✅ NEW: upcoming + overdue reminders
async function getReminders(req, res) {
  try {
    const days = Number(req.query.days || 30);
    const data = remindersService.getReminders({ days });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("getReminders error:", err);
    return res.status(500).json({ ok: false, error: "ServerError", message: err.message });
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
  getReminders, // ✅ added
};
