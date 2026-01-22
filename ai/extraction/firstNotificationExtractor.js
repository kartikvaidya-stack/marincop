// ai/extraction/firstNotificationExtractor.js

/**
 * Heuristic extraction (v1)
 * Later we will replace/augment with OpenAI structured extraction.
 */
function extractFirstNotification(rawText = "") {
  const text = String(rawText || "").trim();

  const lower = text.toLowerCase();

  // Vessel name heuristics
  // Examples: "MV Nova Star", "M/V ABC", "Vessel: XYZ"
  let vesselName = null;
  const vesselPatterns = [
    /vessel\s*[:\-]\s*([^\n\r]+)/i,
    /\bmv\s+([a-z0-9][a-z0-9\-\s]+)/i,
    /\bm\/v\s+([a-z0-9][a-z0-9\-\s]+)/i,
  ];
  for (const p of vesselPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      vesselName = m[1].trim().replace(/\s{2,}/g, " ");
      // If it looks too long, cap it
      if (vesselName.length > 60) vesselName = vesselName.slice(0, 60).trim();
      break;
    }
  }

  // IMO heuristics
  let imo = null;
  const imoMatch = text.match(/\bIMO\s*[:\-]?\s*(\d{7})\b/i);
  if (imoMatch) imo = imoMatch[1];

  // Date/time heuristics (very light in v1)
  // We store as "eventDateText" if found, else null.
  let eventDateText = null;
  const dateMatch =
    text.match(/\b(\d{1,2}\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4})\b/i) ||
    text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) eventDateText = dateMatch[1];

  // Location heuristics
  let locationText = null;
  const locMatch =
    text.match(/\b(position|location)\s*[:\-]\s*([^\n\r]+)/i) ||
    text.match(/\b(at|off|near)\s+([A-Za-z][A-Za-z\s\-,]+)\b/);
  if (locMatch) locationText = (locMatch[2] || "").trim();

  // Incident type heuristics
  // We store "incidentKeywords" for classification help
  const incidentKeywords = [];
  const keywordMap = [
    ["collision", "collision"],
    ["contact", "contact"],
    ["grounding", "grounding"],
    ["fire", "fire"],
    ["explosion", "explosion"],
    ["flood", "flooding"],
    ["flooding", "flooding"],
    ["machinery", "machinery breakdown"],
    ["engine", "engine issue"],
    ["main engine", "main engine issue"],
    ["steering", "steering failure"],
    ["cargo damage", "cargo damage"],
    ["pollution", "pollution"],
    ["oil spill", "pollution"],
    ["crew", "crew injury"],
    ["injury", "injury"],
    ["death", "fatality"],
    ["stow", "stowage"],
    ["heavy weather", "heavy weather"],
    ["weather", "weather"],
    ["salvage", "salvage"],
  ];
  for (const [needle, label] of keywordMap) {
    if (lower.includes(needle)) incidentKeywords.push(label);
  }

  // Parties/counterparties (very light)
  let counterpartyText = null;
  const cpMatch = text.match(/\b(charterer|receiver|shipper|terminal|stevedore|pilot)\s*[:\-]\s*([^\n\r]+)/i);
  if (cpMatch) counterpartyText = `${cpMatch[1]}: ${cpMatch[2].trim()}`;

  // Short summary (first 400 chars)
  const summary = text.length <= 400 ? text : `${text.slice(0, 400).trim()}…`;

  return {
    rawText: text,
    summary,
    vesselName,
    imo,
    eventDateText,
    locationText,
    incidentKeywords,
    counterpartyText,
  };
}

module.exports = {
  extractFirstNotification,
};
