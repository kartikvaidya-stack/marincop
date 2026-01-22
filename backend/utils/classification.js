// backend/utils/classification.js
// Rule-based cover classifier (v1). Later you can upgrade to AI classification.
// Output format matches what your UI already expects: { covers: [{type, confidence, reasoning}] }

function classifyCovers(extraction) {
  const keywords = (extraction?.incidentKeywords || []).map((x) => String(x).toLowerCase());
  const raw = (extraction?.rawText || "").toLowerCase();

  const has = (...ks) => ks.some((k) => keywords.includes(k) || raw.includes(k));
  const covers = [];

  // P&I triggers (third-party liabilities)
  if (has("pollution", "injury", "collision", "contact", "grounding") || raw.includes("p&i")) {
    covers.push({
      type: "P&I",
      confidence: 0.85,
      reasoning:
        "Likely involves third-party liabilities (e.g., contact/collision, injury, pollution, or damage to third-party property).",
    });
  }

  // H&M triggers (ship damage)
  if (has("machinery", "fire", "explosion", "grounding", "collision", "contact") || raw.includes("h&m")) {
    covers.push({
      type: "H&M",
      confidence: 0.7,
      reasoning:
        "Potential physical damage to the insured vessel / machinery, typically responded under Hull & Machinery, subject to deductible and policy terms.",
    });
  }

  // Cargo triggers
  if (has("cargo") || raw.includes("cargo damage") || raw.includes("shortage") || raw.includes("contamination")) {
    covers.push({
      type: "Cargo",
      confidence: 0.65,
      reasoning:
        "Indications of cargo damage/shortage/contamination may fall under cargo interests’ cover (or liability exposure under P&I depending on circumstances).",
    });
  }

  // Charterers' Liability triggers (very rough v1)
  if (raw.includes("charterer") || raw.includes("charter party") || raw.includes("cp") || raw.includes("hire")) {
    covers.push({
      type: "Charterers Liability",
      confidence: 0.55,
      reasoning:
        "References to charterer/CP/hire suggest potential charterers' liability exposure depending on responsibility allocation under the charter party.",
    });
  }

  // If nothing detected
  if (covers.length === 0) {
    covers.push({
      type: "Uncertain",
      confidence: 0.3,
      reasoning: "Insufficient indicators in the first notification to classify cover confidently.",
    });
  }

  return { covers };
}

module.exports = { classifyCovers };
