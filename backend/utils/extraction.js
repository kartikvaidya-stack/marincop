// backend/utils/extraction.js
// Deterministic extractor (v1.1): conservative rules.
// If uncertain, returns null for vessel/date/location instead of guessing.

function clean(s) {
  if (!s) return null;
  const x = String(s).replace(/\r/g, "").trim();
  return x.length ? x : null;
}

function pickFirstMatch(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return clean(m[1]);
  }
  return null;
}

function normalizeVesselName(name) {
  if (!name) return null;
  let x = name.trim();

  // Remove trailing punctuation / excessive whitespace
  x = x.replace(/[;,.\s]+$/g, "").replace(/\s+/g, " ");

  // If it's suspiciously long, it's probably not a vessel name
  if (x.length > 60) return null;

  // Avoid common false positives
  const lower = x.toLowerCase();
  const badStarts = ["incident", "position", "location", "reported", "fire", "damage", "at ", "on "];
  if (badStarts.some((b) => lower.startsWith(b))) return null;

  return x;
}

function extractVessel(text) {
  const t = text;

  // Strong patterns
  const strong = pickFirstMatch(t, [
    /(?:^|\n)\s*Vessel\s*:\s*([^\n]+)\s*(?:\n|$)/i,
    /(?:^|\n)\s*Ship\s*:\s*([^\n]+)\s*(?:\n|$)/i,
    /(?:^|\n)\s*Vsl\s*:\s*([^\n]+)\s*(?:\n|$)/i,
    /(?:^|\n)\s*Vessel\s*Name\s*:\s*([^\n]+)\s*(?:\n|$)/i,
  ]);
  const strongNorm = normalizeVesselName(strong);
  if (strongNorm) return strongNorm;

  // MV/MT/MV. in free text (conservative)
  // e.g. "MV NOVA STAR", "M/V NOVA STAR", "MT NOVA STAR"
  const m = t.match(/\b(?:M\/V|MV|MT)\s+([A-Z0-9][A-Z0-9\s\-]{2,40})\b/);
  if (m && m[1]) {
    const candidate = normalizeVesselName(`${(t.match(/\b(M\/V|MV|MT)\b/) || [])[0] || "MV"} ${m[1]}`.trim());
    if (candidate) return candidate;
  }

  // If we didn't find a confident vessel name, return null (do NOT guess)
  return null;
}

function extractIMO(text) {
  const t = text;
  const imo = pickFirstMatch(t, [
    /(?:^|\n)\s*IMO\s*:\s*(\d{7})\s*(?:\n|$)/i,
    /\bIMO\s*(\d{7})\b/i,
  ]);
  return imo;
}

function extractDateText(text) {
  // Accept common formats but keep as text
  const t = text;

  // Lines like: "22 Jan 2026" or "22 January 2026"
  const line = pickFirstMatch(t, [
    /(?:^|\n)\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s*(?:\n|$)/,
  ]);
  if (line) return line;

  // "Date: 20 Jan 2026"
  const labeled = pickFirstMatch(t, [
    /(?:^|\n)\s*Date\s*:\s*([^\n]+)\s*(?:\n|$)/i,
    /(?:^|\n)\s*Incident\s*Date\s*:\s*([^\n]+)\s*(?:\n|$)/i,
  ]);
  if (labeled && labeled.length <= 40) return labeled;

  return null;
}

function extractLocationText(text) {
  const t = text;

  const labeled = pickFirstMatch(t, [
    /(?:^|\n)\s*Position\s*:\s*([^\n]+)\s*(?:\n|$)/i,
    /(?:^|\n)\s*Location\s*:\s*([^\n]+)\s*(?:\n|$)/i,
    /(?:^|\n)\s*Port\s*:\s*([^\n]+)\s*(?:\n|$)/i,
  ]);
  if (labeled) return labeled;

  return null;
}

function keywordFlags(text) {
  const t = (text || "").toLowerCase();
  const has = (k) => t.includes(k);

  const keywords = [];
  if (has("collision") || has("contact")) keywords.push("contact");
  if (has("pollution") || has("spill") || has("oil spill")) keywords.push("pollution");
  if (has("injury") || has("fatal") || has("death")) keywords.push("injury");
  if (has("fire") || has("explosion")) keywords.push("fire");
  if (has("grounding")) keywords.push("grounding");
  if (has("cargo")) keywords.push("cargo");
  if (has("theft") || has("piracy")) keywords.push("theft/piracy");
  if (has("engine") || has("machinery")) keywords.push("machinery");

  return Array.from(new Set(keywords));
}

module.exports = {
  extractFromFirstNotification(text) {
    const rawText = clean(text) || "";
    const vesselName = extractVessel(rawText);
    const imo = extractIMO(rawText);
    const eventDateText = extractDateText(rawText);
    const locationText = extractLocationText(rawText);

    const incidentKeywords = keywordFlags(rawText);

    // Simple summary = first 600 chars
    const summary = rawText.length > 600 ? rawText.slice(0, 600) + "..." : rawText;

    return {
      rawText,
      summary,
      vesselName, // may be null if uncertain
      imo,
      eventDateText,
      locationText,
      incidentKeywords,
      counterpartyText: null,
      ai: {
        used: false,
        note: "Deterministic extraction only. AI assist will be used if enabled and fields are missing.",
      },
    };
  },
};
