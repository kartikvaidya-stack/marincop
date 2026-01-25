// ai/classification/insuranceClassifierAI.js
// AI-powered insurance classification using OpenAI

const OpenAI = require("openai");

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing in environment");
  return new OpenAI({ apiKey: key });
}

/**
 * AI-powered classification that understands marine insurance context
 * and Nova Carriers' business role
 */
async function aiClassifyInsuranceCase(extraction) {
  const client = getClient();
  const model = process.env.OPENAI_MODEL_CLASSIFICATION || "gpt-4o-mini";

  const rawText = extraction?.rawText || "";
  const vesselName = extraction?.vesselName || "Unknown";
  const incidentType = extraction?.incidentType || "Unknown";

  const schema = {
    name: "marincop_insurance_classification",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        businessRole: {
          type: "string",
          enum: ["vessel_owner", "charterer", "third_party_beneficiary", "unclear"],
          description: "Nova Carriers' role in relation to the vessel",
        },
        covers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                enum: ["P&I", "H&M", "Charterers' Liability", "FD&D", "Cargo", "Spares", "Unclear"],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reasoning: { type: "string" },
            },
            required: ["type", "confidence", "reasoning"],
          },
        },
        reasoning: { type: "string" },
      },
      required: ["businessRole", "covers", "reasoning"],
    },
  };

  const system = [
    "You are a marine insurance expert for Nova Carriers.",
    "Analyze the incident notification and classify applicable insurance covers.",
    "",
    "CRITICAL RULE - If Nova Carriers is the CHARTERER of the vessel:",
    "  - ONLY suggest Charterers' Liability (high confidence)",
    "  - Do NOT suggest H&M (that's the ship owner's coverage)",
    "  - Do NOT suggest P&I unless there's clear third-party liability involvement",
    "  - Charterers have limited exposure (contractual liabilities, cargo operations failures)",
    "",
    "If Nova is the VESSEL OWNER:",
    "  - Suggest H&M for physical damage to the ship/machinery",
    "  - Suggest P&I for third-party liabilities and pollution",
    "  - Suggest other covers as applicable",
    "  - Owners have broad exposure (vessel damage, all liabilities)",
    "",
    "If Nova is a THIRD-PARTY BENEFICIARY:",
    "  - Suggest P&I for any liability exposure",
    "  - Suggest Cargo if goods involved",
    "",
    "Rules:",
    "1. Business role determines cover applicability",
    "2. Charterers' Liability and H&M are mutually exclusive based on role",
    "3. P&I applies to both owners and charterers if third-party liability is involved",
    "4. Return covers sorted by confidence (highest first)",
    "5. If insufficient evidence, set confidence < 0.5",
  ].join("\n");

  const user = [
    "INCIDENT DETAILS:",
    `Vessel: ${vesselName}`,
    `Incident Type: ${incidentType}`,
    "",
    "FIRST NOTIFICATION TEXT:",
    "```",
    rawText,
    "```",
    "",
    "Determine Nova Carriers' business role and classify applicable insurance covers.",
    "Consider: Is Nova the owner, a charterer, or a third party?",
    "Based on the role, suggest the appropriate insurance covers.",
  ].join("\n");

  const resp = await client.responses.create({
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: user }] },
    ],
    response_format: { type: "json_schema", json_schema: schema },
  });

  const text = resp.output_text?.trim() || resp.output?.[0]?.content?.[0]?.text?.trim() || "";
  if (!text) throw new Error("OpenAI returned empty output for classification");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("OpenAI classification output was not valid JSON");
  }

  return { covers: parsed.covers || [], businessRole: parsed.businessRole };
}

module.exports = {
  aiClassifyInsuranceCase,
};
