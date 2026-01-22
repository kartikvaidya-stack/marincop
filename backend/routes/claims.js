// backend/routes/claims.js

const express = require("express");
const router = express.Router();

const {
  createClaim,
  listClaims,
  getClaim,
  patchProgress,
  patchFinance,
  patchAction,
  getDrafts,
  getDueReminders,
} = require("../controllers/claimsController");

// LIST + CREATE
router.get("/", listClaims);
router.post("/", createClaim);

// REMINDERS (place before /:id to avoid param conflicts)
router.get("/reminders/due", getDueReminders);

// IMPORTANT: put drafts BEFORE "/:id"
router.get("/:id/drafts", getDrafts);

// SINGLE CLAIM
router.get("/:id", getClaim);

// PATCHES
router.patch("/:id/progress", patchProgress);
router.patch("/:id/finance", patchFinance);
router.patch("/:id/actions/:actionId", patchAction);

module.exports = router;
