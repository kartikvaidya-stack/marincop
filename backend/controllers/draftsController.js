// backend/controllers/draftsController.js
const { getClaimById } = require("../services/claimService");
const { generateDrafts } = require("../../ai/drafting/draftGenerator");

async function generateDraftsController(req, res, next) {
  try {
    const claim = await getClaimById(req.params.claimId);
    const drafts = generateDrafts({ claim });
    res.json({ ok: true, data: drafts });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  generateDraftsController,
};
