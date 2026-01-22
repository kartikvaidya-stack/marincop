// backend/routes/drafts.js
const express = require("express");
const { generateDraftsController } = require("../controllers/draftsController");

const router = express.Router();

router.post("/:claimId/drafts", generateDraftsController);

module.exports = router;
