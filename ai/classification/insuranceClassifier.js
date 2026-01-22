// ai/classification/insuranceClassifier.js

/**
 * Returns:
 * - covers: array of { type, confidence, reasoning }
 * Supports multiple cover suggestions.
 */
function classifyInsuranceCase(extraction) {
  const raw = (extraction?.rawText || "").toLowerCase();
  const keywords = extraction?.incidentKeywords || [];

  const covers = [];

  // Helper
  function add(type, confidence, reasoning) {
    covers.push({ type, confidence, reasoning });
  }

  // P&I indicators (liability / third party / pollution / injury)
  const piTriggers = [
    "collision",
    "contact",
    "pollution",
    "oil spill",
    "injury",
    "fatality",
    "crew",
    "pilot",
    "stevedore",
    "third party",
    "liability",
    "damaged berth",
    "damaged jetty",
  ];
  const piHit = piTriggers.some((k) => raw.includes(k)) || keywords.some((k) => ["collision", "contact", "pollution", "crew injury", "fatality"].includes(k));
  if (piHit) {
    add(
      "P&I",
      0.85,
      "Likely involves third-party liabilities (e.g., contact/collision, injury, pollution, or damage to third-party property)."
    );
  }

  // H&M indicators (damage to ship / machinery / repairs)
  const hmTriggers = [
    "machinery",
    "engine",
    "main engine",
    "steering",
    "fire",
    "explosion",
    "flooding",
    "grounding",
    "repairs",
    "drydock",
    "damage to hull",
    "propeller",
    "rudder",
  ];
  const hmHit = hmTriggers.some((k) => raw.includes(k)) || keywords.some((k) => ["grounding", "fire", "explosion", "flooding", "machinery breakdown", "engine issue", "steering failure"].includes(k));
  if (hmHit) {
    add(
      "H&M",
      0.8,
      "Likely physical damage to the vessel and/or machinery requiring repairs."
    );
  }

  // Charterers’ Liability indicators (charterparty / off-hire / breach / cargo ops delays caused by charterer side)
  const clTriggers = [
    "charterer",
    "charter party",
    "cp clause",
    "demurrage",
    "despatch",
    "off-hire",
    "offhire",
    "unsafe port",
    "unsafe berth",
    "terminal",
    "shore conveyor",
    "stevedores",
    "loading delay",
    "discharging delay",
    "cargo operations",
  ];
  const clHit = clTriggers.some((k) => raw.includes(k));
  if (clHit) {
    add(
      "Charterers' Liability",
      0.65,
      "Notification references charterparty/terminal/cargo operations or potential contractual liabilities linked to chartering performance."
    );
  }

  // FD&D indicators (disputes / legal)
  const fddTriggers = ["dispute", "lawyers", "arbitration", "claim against", "reject", "deny", "breach", "legal"];
  const fddHit = fddTriggers.some((k) => raw.includes(k));
  if (fddHit) {
    add(
      "FD&D",
      0.6,
      "Potential legal/contractual dispute indicated; FD&D may support legal costs and advice."
    );
  }

  // Cargo
  const cargoTriggers = ["cargo damage", "wet cargo", "contamination", "shortage", "loss of cargo", "temperature", "heating", "sweating"];
  const cargoHit = cargoTriggers.some((k) => raw.includes(k)) || keywords.includes("cargo damage");
  if (cargoHit) {
    add(
      "Cargo",
      0.6,
      "Cargo damage/shortage/contamination indicators present; may involve cargo claims (often via P&I for liability, depending on facts)."
    );
  }

  // If nothing matched, still create a case as "Advisory / Unclear"
  if (covers.length === 0) {
    add(
      "Unclear / Needs Review",
      0.4,
      "Insufficient indicators to classify confidently from initial text; recommend manual review and follow-up questions."
    );
  }

  // Sort by confidence desc
  covers.sort((a, b) => b.confidence - a.confidence);

  return { covers };
}

module.exports = {
  classifyInsuranceCase,
};
