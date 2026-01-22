// backend/utils/extraction.js
// Robust "first notification" extraction (non-AI baseline).
// Goal: reliably pull vessel name, IMO, date text, location, keywords from messy text.

function cleanLine(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .trim();
}

function normSpaces(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function stripQuotes(s) {
  return String(s || "").replace(/^["'“”]+|["'“”]+$/g, "").trim();
}

function looksLikeVesselName(candidate) {
  const c = normSpaces(stripQuotes(candidate));
  if (!c) return false;

  // Too long usually means we captured a sentence, not a name
  if (c.length > 40) return false;

  // Avoid capturing full incident descriptions
  const badWords = [
    "incident",
    "reported",
    "contact",
    "collision",
    "grounding",
    "fire",
    "damage",
    "cargo",
    "anchorage",
    "position",
    "latitude",
    "longitude",
    "lat",
    "lon",
    "no pollution",
    "please advise",
  ];
  const lc = c.toLowerCase();
  if (badWords.some((w) => lc.includes(w))) return false;

  // Must have some letters
  if (!/[A-Za-z]/.test(c)) return false;

  return true;
}

// Extract IMO (7 digits)
function extractIMO(text) {
  const m = String(text || "").match(/\bIMO[:\s#-]*([0-9]{7})\b/i);
  return m ? m[1] : null;
}

// Extract vessel name with multiple strategies
function extractVesselName(text) {
  const t = String(text || "");
  const lines = t.split("\n").map(cleanLine).filter(Boolean);

  // 1) Explicit label patterns on a line (best)
  // Vessel: MV NOVA STAR
  // Ship: NOVA STAR
  // Name: M/T NOVA STAR
  for (const line of lines) {
    const m = line.match(/^(vessel|ship|vsl|name)\s*[:=-]\s*(.+)$/i);
    if (m && m[2]) {
      let cand = normSpaces(m[2]);
      cand = cand.replace(/\(.*?\)/g, "").trim(); // drop bracket remarks
      cand = cand.replace(/\b(imo|flag|call\s*sign)\b.*$/i, "").trim();
      // If line begins with MV/MV. etc keep it; otherwise also ok.
      if (looksLikeVesselName(cand)) return cand.toUpperCase().startsWith("MV ") || cand.toUpperCase().startsWith("MT ") || cand.toUpperCase().startsWith("M/V") || cand.toUpperCase().startsWith("M/T")
        ? cand
        : cand;
    }
  }

  // 2) Common "MV/M/V/MT/M/T <NAME>" anywhere in the text
  // Keep NAME as 2-5 tokens, stop at punctuation/newline.
  const mvRegex = /\b(MV|M\/V|MT|M\/T)\s+([A-Z0-9][A-Z0-9 \-]{2,40})(?=[$\n\r,.;:)]|\bIMO\b|\bDATE\b|\bPOSITION\b|\bINCIDENT\b|\bAT\b|\bON\b|$)/i;
  const mvMatch = t.match(mvRegex);
  if (mvMatch && mvMatch[0]) {
    const cand = normSpaces(mvMatch[0]);
    if (looksLikeVesselName(cand)) return cand;
  }

  // 3) Try "Vessel <NAME>" (no colon)
  const v2 = t.match(/\bVessel\s+([A-Z0-9][A-Z0-9 \-]{2,40})\b/i);
  if (v2 && v2[1]) {
    const cand = normSpaces(v2[1]);
    if (looksLikeVesselName(cand)) return cand;
  }

  // 4) Fallback: first line that looks like a vessel name (short and clean)
  for (const line of lines.slice(0, 6)) {
    const cand = normSpaces(line)
      .replace(/\b(imo|date|position|incident|location)\b.*$/i, "")
      .trim();
    if (looksLikeVesselName(cand)) return cand;
  }

  return null;
}

// Date text: keep as raw snippet rather than parsing hard
function extractEventDateText(text) {
  const t = String(text || "");
  // Examples: 22 Jan 2026, 22 January 2026, 2026-01-22
  const m =
    t.match(/\b([0-3]?\d\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i) ||
    t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return m ? m[1] : null;
}

function extractLocationText(text) {
  const t = String(text || "");
  const lines = t.split("\n").map(cleanLine).filter(Boolean);

  for (const line of lines) {
    const m = line.match(/^(position|location|port)\s*[:=-]\s*(.+)$/i);
    if (m && m[2]) {
      const cand = normSpaces(m[2]).replace(/\(.*?\)/g, "").trim();
      if (cand.length <= 60) return cand;
    }
  }

  // Fallback: "<place> Anchorage" pattern
  const m2 = t.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+Anchorage)\b/);
  if (m2) return m2[1];

  return null;
}

function extractKeywords(text) {
  const t = String(text || "").toLowerCase();
  const keys = [];
  const add = (k, variants) => {
    if (variants.some((v) => t.includes(v))) keys.push(k);
  };

  add("contact", ["contact", "allision", "berth", "jetty"]);
  add("collision", ["collision", "collided"]);
  add("grounding", ["grounding", "aground"]);
  add("fire", ["fire", "smoke", "burning"]);
  add("pollution", ["pollution", "spill", "oil leak", "sheen"]);
  add("injury", ["injury", "injured", "fatal", "death", "man overboard"]);
  add("cargo damage", ["cargo damage", "wet cargo", "contamination", "shortage"]);
  add("machinery", ["main engine", "m/e", "generator", "breakdown", "blackout"]);

  return Array.from(new Set(keys));
}

function extractFromFirstNotification(rawText) {
  const raw = String(rawText || "");
  const summary = raw.trim();

  const vesselName = extractVesselName(raw);
  const imo = extractIMO(raw);
  const eventDateText = extractEventDateText(raw);
  const locationText = extractLocationText(raw);
  const incidentKeywords = extractKeywords(raw);

  return {
    rawText: raw,
    summary,
    vesselName,
    imo,
    eventDateText,
    locationText,
    incidentKeywords,
    counterpartyText: null,
  };
}

module.exports = {
  extractFromFirstNotification,
  extractVesselName,
  extractIMO,
};
