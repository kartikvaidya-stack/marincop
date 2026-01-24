// backend/app.js
const express = require("express");
const cors = require("cors");

const claimsRoutes = require("./routes/claims");

const app = express();

// --- Core middleware (MUST be before routes) ---
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Ensure JSON bodies are parsed for POST/PATCH/PUT
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Helpful debug: if JSON parsing failed or body missing, we still don't crash later
app.use((req, _res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// --- Routes ---
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "marincop-backend",
    company: "Nova Carriers",
    time: new Date().toISOString(),
  });
});

app.use("/api/claims", claimsRoutes);

// --- 404 ---
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "NotFound", message: "Route not found" });
});

// --- Error handler ---
app.use((err, _req, res, _next) => {
  console.error("❌ API Error:", err);
  res.status(500).json({
    ok: false,
    error: err?.name || "ServerError",
    message: err?.message || "Unhandled error",
  });
});

module.exports = app;
