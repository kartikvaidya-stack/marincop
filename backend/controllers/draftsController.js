// backend/controllers/draftsController.js
const OpenAI = require("openai");
const { getClaimById } = require("../services/claimService");
const { generateDrafts } = require("../../ai/drafting/draftGenerator");
const claimService = require("../services/claimService");

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return new OpenAI({ apiKey: key });
}

async function generateDraftsController(req, res, next) {
  try {
    const claim = await getClaimById(req.params.claimId);
    const drafts = generateDrafts({ claim });
    res.json({ ok: true, data: drafts });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/claims/:id/draft-from-action
 * Body: { actionTitle, actionId }
 * Generates a draft response/email based on an action using OpenAI
 */
async function generateDraftFromAction(req, res) {
  try {
    const claimId = req.params.id;
    const body = req.body || {};
    const actionTitle = body.actionTitle || "Unknown action";
    
    const claim = claimService.getClaim(claimId);
    if (!claim) {
      return res.status(404).json({
        ok: false,
        error: "NotFound",
        message: "Claim not found",
      });
    }

    const client = getClient();
    const model = process.env.OPENAI_MODEL_DRAFT || "gpt-4o-mini";

    // Build context for the draft
    const vessel = claim.extraction?.vesselName || "Unknown Vessel";
    const claimNumber = claim.claimNumber || "TBD";
    const incidentType = claim.extraction?.incidentType || "Incident";
    const date = claim.extraction?.eventDateText || "TBD";
    const location = claim.extraction?.locationText || "TBD";
    const covers = (claim.classification?.covers || []).map(c => c.type).join(", ");

    const systemPrompt = [
      "You are a professional marine insurance claims correspondent for Nova Carriers.",
      "Generate a professional, concise email/letter draft in response to an action.",
      "The draft should be ready to send with minimal editing.",
      "Include subject line and body.",
      "Keep it clear, professional, and to the point.",
    ].join("\n");

    const userPrompt = [
      `Vessel: ${vessel}`,
      `Claim Ref: ${claimNumber}`,
      `Incident: ${incidentType}`,
      `Date: ${date}`,
      `Location: ${location}`,
      `Covers: ${covers}`,
      "",
      `Action/Task: ${actionTitle}`,
      "",
      "Generate a professional email/letter draft for this action.",
      "Format as JSON with 'subject' and 'body' fields.",
    ].join("\n");

    const schema = {
      name: "draft_email",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          draftType: { type: "string" },
        },
        required: ["subject", "body", "draftType"],
      },
    };

    const resp = await client.responses.create({
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
      response_format: { type: "json_schema", json_schema: schema },
    });

    const text = resp.output_text?.trim() || "";
    if (!text) throw new Error("OpenAI returned empty output");

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error("OpenAI output was not valid JSON");
    }

    return res.json({
      ok: true,
      data: {
        subject: parsed.subject || "",
        body: parsed.body || "",
        draftType: parsed.draftType || "action-based",
        actionTitle: actionTitle,
      },
    });
  } catch (err) {
    console.error("❌ Draft generation error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.name || "ServerError",
      message: err?.message || "Failed to generate draft",
    });
  }
}

module.exports = {
  generateDraftsController,
  generateDraftFromAction,
};
