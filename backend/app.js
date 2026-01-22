// backend/app.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const claimsRouter = require("./routes/claims");
const draftsRouter = require("./routes/drafts");

const app = express();

app.set("trust proxy", true);

/**
 * CORS
 * NOTE:
 * We do NOT use cookies/sessions yet, so credentials must be false.
 * This avoids the invalid combination: origin="*" + credentials=true.
 */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    credentials: false,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/**
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "marincop-backend",
    company: "Nova Carriers",
    time: new Date().toISOString(),
  });
});

/**
 * Claims API
 */
app.use("/api/claims", claimsRouter);

/**
 * Drafts API
 * POST /api/claims/:claimId/drafts
 */
app.use("/api/claims", draftsRouter);

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not Found",
    path: req.originalUrl,
  });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(err.status || 500).json({
    ok: false,
    error: err.name || "ServerError",
    message: err.message || "Unexpected server error",
  });
});

module.exports = app;
