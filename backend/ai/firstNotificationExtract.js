// backend/ai/firstNotificationExtract.js
// AI-first extractor with strict JSON schema (Responses API). Falls back handled by caller.

const OpenAI = require("openai");

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing in environment");
  return new OpenAI({ apiKey: key });
}

function safeStr(x) {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  return s.length ? s : null;
}

function normalizeExtraction(obj, rawText) {
  const incidentKeywords = Array.isArray(obj.incidentKeywords)
    ? Array.from(new Set(obj.incidentKeywords.map((x) => String(x).toLowerCase().trim()).filter(Boolean)))
    : [];

  return {
    rawText: rawText || "",
    summary: safeStr(obj.summary) || (rawText || ""),
    vesselName: safeStr(obj.vesselName),
    imo: safeStr(obj.imo),
    eventDateText: safeStr(obj.eventDateText),
    locationText: safeStr(obj.locationText),
    counterpartyText: safeStr(obj.counterpartyText),
    incidentKeywords,
    incidentType: safeStr(obj.incidentType),
    allegedCause: safeStr(obj.allegedCause),
    pilotInvolved: obj.pilotInvolved === true ? true : obj.pilotInvolved === false ? false : null,
    pollutionReported: obj.pollutionReported === true ? true : obj.pollutionReported === false ? false : null,
    injuriesReported: obj.injuriesReported === true ? true : obj.injuriesReported === false ? false : null,
    immediateActionsTaken: Array.isArray(obj.immediateActionsTaken)
      ? obj.immediateActionsTaken.map((x) => String(x)).filter(Boolean)
      : [],
    missingInfoToRequest: Array.isArray(obj.missingInfoToRequest)
      ? obj.missingInfoToRequest.map((x) => String(x)).filter(Boolean)
      : [],
    confidence: typeof obj.confidence === "number" ? obj.confidence : 0.6,
    warnings: Array.isArray(obj.warnings) ? obj.warnings.map(String) : [],
  };
}

function extractTextFromResponses(resp) {
  // SDKs may expose output_text; keep robust fallback.
  if (resp && typeof resp.output_text === "string" && resp.output_text.trim()) return resp.output_text.trim();

  // Fallback: walk outputs
  const out = resp?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          const t = c?.text;
          if (typeof t === "string" && t.trim()) return t.trim();
        }
      }
    }
  }
  return "";
}

async function aiExtractFirstNotification(rawText) {
  const client = getClient();

  const model = process.env.OPENAI_MODEL_FIRST_NOTIFICATION || "gpt-4o-mini";

  const schema = {
    name: "marincop_first_notification_extraction",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },

        vesselName: { type: ["string", "null"] },
        imo: { type: ["string", "null"] },
        eventDateText: { type: ["string", "null"] },
        locationText: { type: ["string", "null"] },
        counterpartyText: { type: ["string", "null"] },

        incidentType: { type: ["string", "null"] },
        allegedCause: { type: ["string", "null"] },

        pilotInvolved: { type: ["boolean", "null"] },
        pollutionReported: { type: ["boolean", "null"] },
        injuriesReported: { type: ["boolean", "null"] },

        incidentKeywords: {
          type: "array",
          items: { type: "string" },
        },

        immediateActionsTaken: {
          type: "array",
          items: { type: "string" },
        },

        missingInfoToRequest: {
          type: "array",
          items: { type: "string" },
        },

        confidence: { type: "number" },

        warnings: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "summary",
        "vesselName",
        "imo",
        "eventDateText",
        "locationText",
        "counterpartyText",
        "incidentType",
        "allegedCause",
        "pilotInvolved",
        "pollutionReported",
        "injuriesReported",
        "incidentKeywords",
        "immediateActionsTaken",
        "missingInfoToRequest",
        "confidence",
        "warnings",
      ],
    },
  };

  const system = [
    "You are Marincop, a marine insurance co-pilot for Nova Carriers.",
    "Extract structured fields from a messy first notification (email/whatsapp/forwarded chain).",
    "Return ONLY valid JSON that matches the provided schema.",
    "If a field is unknown, return null (not an empty string).",
    "incidentKeywords should be short lower-case tags (e.g., contact, collision, grounding, pollution, injury, cargo, fire, machinery, weather).",
    "For locationText: extract ANY location/port/city name mentioned, even if standalone (e.g., 'Balikpapan', 'off Singapore', 'at Hamburg'). Include maritime ports and geographic locations.",
    "Common maritime locations: Singapore, Port Said, Rotterdam, Hamburg, Shanghai, Hong Kong, Dubai, Los Angeles, etc.",
  ].join("\n");

  const user = [
    "FIRST NOTIFICATION TEXT (raw):",
    "```",
    rawText || "",
    "```",
  ].join("\n");

  const resp = await client.responses.create({
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: user }] },
    ],
    response_format: { type: "json_schema", json_schema: schema },
  });

  const text = extractTextFromResponses(resp);
  if (!text) throw new Error("OpenAI returned empty output");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("OpenAI output was not valid JSON");
  }

  return normalizeExtraction(parsed, rawText || "");
}

module.exports = { aiExtractFirstNotification };
