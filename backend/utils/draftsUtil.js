// backend/utils/draftsUtil.js

/**
 * Generate drafting templates for a claim.
 * This is "templates only" as you requested (no OpenAI calls here).
 * Frontend can copy/paste these drafts and optionally send externally.
 */
function safeStr(v, fallback = "") {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function coverTypes(claim) {
  const covers = claim?.classification?.covers || [];
  return Array.isArray(covers) ? covers.map((c) => c.type).filter(Boolean) : [];
}

function headerLine(claim) {
  const cn = safeStr(claim?.claimNumber, "MC-NOVA-XXXX-XXXX");
  const vessel = safeStr(claim?.extraction?.vesselName, safeStr(claim?.vesselName, "Vessel"));
  return `[${cn}] - ${vessel}`;
}

function buildPINotification(claim) {
  const cn = safeStr(claim?.claimNumber);
  const vessel = safeStr(claim?.extraction?.vesselName, safeStr(claim?.vesselName, ""));
  const imo = safeStr(claim?.extraction?.imo, "");
  const dt = safeStr(claim?.extraction?.eventDateText, "");
  const loc = safeStr(claim?.extraction?.locationText, "");
  const raw = safeStr(claim?.extraction?.rawText, safeStr(claim?.firstNotificationText, ""));

  return {
    type: "P&I_NOTIFICATION",
    subject: `${headerLine(claim)} - P&I Notification (Initial)`,
    body:
`Dear P&I Club / Correspondents,

We hereby give initial notification of an incident that may give rise to liabilities and/or costs falling within P&I cover.

Claim Ref: ${cn}
Vessel: ${vessel}${imo ? ` (IMO ${imo})` : ""}
Date/Time (as advised): ${dt || "TBC"}
Location/Position: ${loc || "TBC"}

Initial description (as received):
${raw || "(text not provided)"}

Immediate actions taken / proposed:
- Evidence preservation initiated (photos, statements, log extracts)
- Request guidance on next steps and appointment of surveyor (if required)
- Please advise any specific reporting format / documents required

Kindly acknowledge receipt and advise recommended course of action, including any correspondent/surveyor nomination.

Best regards,
Nova Carriers
(Claims Team)`
  };
}

function buildSurveyorAppointment(claim) {
  const cn = safeStr(claim?.claimNumber);
  const vessel = safeStr(claim?.extraction?.vesselName, safeStr(claim?.vesselName, ""));
  const dt = safeStr(claim?.extraction?.eventDateText, "");
  const loc = safeStr(claim?.extraction?.locationText, "");

  return {
    type: "SURVEYOR_APPOINTMENT",
    subject: `${headerLine(claim)} - Survey Appointment Request`,
    body:
`Dear Sir/Madam,

Nova Carriers requests your attendance / appointment as surveyor in relation to the below incident.

Claim Ref: ${cn}
Vessel: ${vessel}
Incident date: ${dt || "TBC"}
Location: ${loc || "TBC"}

Please confirm:
1) Earliest attendance and ETA
2) Information/documents required prior attendance
3) Expected deliverables and timeline for preliminary and final report

We will provide photographs, statements, and relevant extracts upon confirmation.

Best regards,
Nova Carriers
(Claims Team)`
  };
}

function buildHMNotification(claim) {
  const cn = safeStr(claim?.claimNumber);
  const vessel = safeStr(claim?.extraction?.vesselName, safeStr(claim?.vesselName, ""));
  const imo = safeStr(claim?.extraction?.imo, "");
  const dt = safeStr(claim?.extraction?.eventDateText, "");
  const loc = safeStr(claim?.extraction?.locationText, "");
  const raw = safeStr(claim?.extraction?.rawText, "");

  return {
    type: "H&M_NOTIFICATION",
    subject: `${headerLine(claim)} - H&M Notification (Initial)`,
    body:
`Dear H&M Underwriters / Claims Handlers,

We hereby give initial notification of an occurrence that may give rise to a claim under Hull & Machinery cover.

Claim Ref: ${cn}
Vessel: ${vessel}${imo ? ` (IMO ${imo})` : ""}
Date/Time (as advised): ${dt || "TBC"}
Location/Position: ${loc || "TBC"}

Initial description (as received):
${raw || "(text not provided)"}

Requested next steps:
- Please confirm claims handling instructions
- Please advise surveyor/class attendance requirements
- Please advise any documentation format required at this stage

Best regards,
Nova Carriers
(Claims Team)`
  };
}

function buildChaseReminder(claim) {
  const cn = safeStr(claim?.claimNumber);
  const vessel = safeStr(claim?.extraction?.vesselName, safeStr(claim?.vesselName, ""));
  const pending = (claim?.actions || []).find((a) => a.status !== "DONE");
  const pendingTitle = pending ? pending.title : "Pending item";

  return {
    type: "CHASE_REMINDER",
    subject: `${headerLine(claim)} - Follow-up / Chase`,
    body:
`Dear All,

Gentle reminder / follow-up in relation to Claim Ref ${cn} (${vessel}).

Pending item:
- ${pendingTitle}

Kindly provide an update and expected timeline for closure.

Best regards,
Nova Carriers
(Claims Team)`
  };
}

/**
 * Public API used by claimService.js
 */
function generateDrafts(claim) {
  const covers = coverTypes(claim);

  const drafts = [];

  // Always provide a chase template
  drafts.push(buildChaseReminder(claim));

  // Cover-dependent
  if (covers.includes("P&I")) drafts.unshift(buildPINotification(claim));
  if (covers.includes("H&M") || covers.includes("H&M (Hull)")) drafts.unshift(buildHMNotification(claim));

  // Surveyor request is generally useful for most incidents
  drafts.push(buildSurveyorAppointment(claim));

  return drafts;
}

module.exports = {
  generateDrafts,
};
