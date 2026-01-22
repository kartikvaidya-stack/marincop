// backend/routes/claims.js

const express = require("express");
const router = express.Router();

const {
  listClaims,
  createClaim,
  getClaim,
  updateProgress,
  updateFinance,
  updateAction,
  getDueReminders,
  snoozeActionReminder,
} = require("../controllers/claimsController");

// List + Create
router.get("/", listClaims);
router.post("/", createClaim);

// Reminders (place BEFORE /:id so it doesn't get captured as :id)
router.get("/reminders/due", getDueReminders);

// Single claim
router.get("/:id", getClaim);

// Updates
router.patch("/:id/progress", updateProgress);
router.patch("/:id/finance", updateFinance);

// Actions
router.patch("/:id/actions/:actionId", updateAction);
router.patch("/:id/actions/:actionId/reminder", snoozeActionReminder);

module.exports = router;
