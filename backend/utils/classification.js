// backend/utils/classification.js
// Classify likely covers from extracted keywords/text.
// Conservative and explainable (v1).

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function hasAny(text, words) {
  const t = (text || "").toLowerCase();
  return (words || []).some((w) => t.includes(String(w).toLowerCase()));
}

function scoreCover({ rawText, incidentKeywords }, coverType) {
  const t = (rawText || "").toLowerCase();
  const keys = (incidentKeywords || []).map((x) => String(x).toLowerCase());

  const hasKey = (k) => keys.includes(k);

  // Heuristic scoring
  let score = 0;
  let reasons = [];

  if (coverType === "P&I") {
    if (hasKey("contact") || hasAny(t, ["berth", "jetty", "dock", "pier", "allision", "collision", "contact"])) {
      score += 0.35;
      reasons.push("Contact/collision suggests third-party/property liabilities (typical P&I).");
    }
    if (hasKey("pollution") || hasAny(t, ["pollution", "spill", "oil spill", "bunker spill"])) {
      score += 0.4;
      reasons.push("Pollution/spill exposure is primarily P&I.");
    }
    if (hasKey("injury") || hasAny(t, ["injury", "fatal", "death", "medevac"])) {
      score += 0.35;
      reasons.push("Crew/third-party injury/fatality exposure is primarily P&I.");
    }
    if (hasAny(t, ["pilot", "tug", "mooring", "stevedore", "agent"])) {
      score += 0.15;
      reasons.push("Operational third-party involvement often triggers P&I handling.");
    }
  }

  if (coverType === "H&M") {
    if (hasAny(t, ["denting", "shell plating", "hull", "propeller", "rudder", "engine", "machinery", "damage to vessel"])) {
      score += 0.45;
      reasons.push("Physical damage to vessel/hull/machinery suggests H&M.");
    }
    if (hasKey("grounding") || hasAny(t, ["grounding", "aground"])) {
      score += 0.45;
      reasons.push("Grounding often involves hull damage (H&M) and liabilities (P&I).");
    }
    if (hasKey("fire") || hasAny(t, ["fire", "explosion"])) {
      score += 0.35;
      reasons.push("Fire/explosion frequently results in vessel damage (H&M).");
    }
  }

  if (coverType === "Cargo") {
    if (hasKey("cargo") || hasAny(t, ["cargo damage", "damaged cargo", "wet damage", "shortage", "contamination"])) {
      score += 0.5;
      reasons.push("Cargo damage/shortage indicators suggest cargo-related claim handling.");
    }
    if (hasAny(t, ["hold fire", "cargo hold fire", "pulp", "coal", "grain", "clinker", "steel"])) {
      score += 0.2;
      reasons.push("Commodity/hold-related incident hints at cargo interest involvement.");
    }
  }

  if (coverType === "Charterers Liability") {
    if (hasAny(t, ["charterer", "charterers", "time charter", "voyage charter", "terminal delay", "berth nomination"])) {
      score += 0.5;
      reasons.push("Text indicates charterer-related responsibilities/liabilities.");
    }
    if (hasAny(t, ["unsafe port", "unsafe berth", "orders", "employment orders"])) {
      score += 0.35;
      reasons.push("Unsafe port/berth or employment orders can trigger charterers’ liability exposure.");
    }
  }

  // clamp
  score = Math.max(0, Math.min(1, score));
  return { score, reasons };
}

function classifyFromExtraction(extraction) {
  const rawText = extraction?.rawText || "";
  const incidentKeywords = extraction?.incidentKeywords || [];

  const candidates = ["P&I", "H&M", "Cargo", "Charterers Liability"];
  const scored = candidates.map((type) => {
    const { score, reasons } = scoreCover({ rawText, incidentKeywords }, type);
    return { type, score, reasons };
  });

  // Select covers above threshold; always return at least one (best score)
  const threshold = 0.35;
  let selected = scored.filter((x) => x.score >= threshold);

  if (selected.length === 0) {
    const best = scored.sort((a, b) => b.score - a.score)[0];
    selected = best ? [best] : [];
  }

  // Convert to output format expected by UI/backend
  const covers = selected
    .sort((a, b) => b.score - a.score)
    .map((x) => ({
      type: x.type,
      confidence: Number(x.score.toFixed(2)),
      reasoning: uniq(x.reasons).join(" "),
    }));

  return { covers };
}

module.exports = {
  classifyFromExtraction,
};
