// backend/utils/extraction.js
// AI-first extraction with rule-based fallback.
// NOTE: This is async now. Caller must await extractFirstNotification().

const { aiExtractFirstNotification } = require("../ai/firstNotificationExtract");

function clean(s) {
  return (s || "").toString().trim();
}

function findFirstMatch(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return clean(m[1]);
  }
  return null;
}

function extractKeywords(text) {
  const t = (text || "").toLowerCase();
  const keywords = [];

  const map = [
    ["collision", ["collision", "collided", "allision", "contact"]],
    ["contact", ["contact", "allision", "berth", "jetty", "quay", "fender"]],
    ["grounding", ["grounding", "aground", "stranded"]],
    ["pollution", ["pollution", "spill", "oil leak", "sheen", "bunker spill", "slick"]],
    ["injury", ["injury", "injured", "fatal", "fatality", "death", "man overboard"]],
    ["cargo", ["cargo damage", "wet", "contamination", "shortage", "heated", "condensation"]],
    ["fire", ["fire", "explosion"]],
    ["machinery", ["machinery", "engine", "main engine", "aux engine", "breakdown"]],
    ["piracy", ["piracy", "armed robbery", "robbery"]],
    ["weather", ["heavy weather", "rough weather", "storm", "typhoon", "monsoon"]],
  ];

  for (const [key, terms] of map) {
    if (terms.some((w) => t.includes(w))) keywords.push(key);
  }

  return Array.from(new Set(keywords));
}

function ruleBasedExtract(rawText) {
  const raw = clean(rawText);
  const text = raw.replace(/\r\n/g, "\n");

  const vesselName =
    findFirstMatch(text, [
      /Vessel\s*:\s*(.+)/i,
      /M\/V\s*[:\-]?\s*(.+)/i,
      /MV\s+([A-Z0-9\-\s]+)/i,
    ]) || null;

  const imo =
    findFirstMatch(text, [
      /IMO\s*:\s*([0-9]{7})/i,
      /IMO\s*No\.?\s*[:\-]?\s*([0-9]{7})/i,
    ]) || null;

  const eventDateText =
    findFirstMatch(text, [/(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i, /(\d{4}-\d{2}-\d{2})/i]) || null;

  const locationText =
    findFirstMatch(text, [/Position\s*:\s*(.+)/i, /Location\s*:\s*(.+)/i, /Port\s*:\s*(.+)/i]) || null;

  const counterpartyText =
    findFirstMatch(text, [/Counterparty\s*:\s*(.+)/i, /Charterer\s*:\s*(.+)/i, /Terminal\s*:\s*(.+)/i]) || null;

  const incidentKeywords = extractKeywords(text);

  return {
    rawText: raw,
    summary: raw,
    vesselName,
    imo,
    eventDateText,
    locationText,
    incidentKeywords,
    counterpartyText,

    // extra AI fields (null in fallback)
    incidentType: null,
    allegedCause: null,
    pilotInvolved: null,
    pollutionReported: null,
    injuriesReported: null,
    immediateActionsTaken: [],
    missingInfoToRequest: [],
    confidence: 0.45,
    warnings: ["AI not used; rule-based fallback applied."],
  };
}

async function extractFirstNotification(rawText) {
  const raw = clean(rawText);

  // If no key, fallback immediately
  if (!process.env.OPENAI_API_KEY) return ruleBasedExtract(raw);

  try {
    const ai = await aiExtractFirstNotification(raw);

    // If AI returned nothing meaningful, fallback
    if (!ai || !ai.summary) return ruleBasedExtract(raw);

    return ai;
  } catch (e) {
    const fb = ruleBasedExtract(raw);
    fb.warnings = (fb.warnings || []).concat([`AI extraction failed: ${e.message}`]);
    return fb;
  }
}

module.exports = { extractFirstNotification };
