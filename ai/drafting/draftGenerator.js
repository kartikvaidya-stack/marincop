// ai/drafting/draftGenerator.js

function safe(v) {
  return v ? String(v) : "";
}

function buildSubject({ claimNumber, vesselName, incident }) {
  const v = vesselName ? ` - ${vesselName}` : "";
  const i = incident ? ` - ${incident}` : "";
  return `[${claimNumber}]${v}${i}`.trim();
}

function draftPiNotification({ claim }) {
  const claimNumber = claim.claimNumber;
  const vessel = safe(claim.extraction?.vesselName);
  const imo = safe(claim.extraction?.imo);
  const date = safe(claim.extraction?.eventDateText);
  const loc = safe(claim.extraction?.locationText);
  const summary = safe(claim.extraction?.summary);

  const subject = buildSubject({
    claimNumber,
    vesselName: vessel,
    incident: "P&I Notification (Initial)",
  });

  const body = `Dear P&I Club / Correspondents,

We hereby give initial notification of an incident that may give rise to liabilities and/or costs falling within P&I cover.

Claim Ref: ${claimNumber}
Vessel: ${vessel}${imo ? ` (IMO ${imo})` : ""}
Date/Time (as advised): ${date || "TBC"}
Location/Position: ${loc || "TBC"}

Initial description (as received):
${summary}

Immediate actions taken / proposed:
- Evidence preservation initiated (photos, statements, log extracts)
- Request guidance on next steps and appointment of surveyor (if required)
- Please advise any specific reporting format / documents required

Kindly acknowledge receipt and advise recommended course of action, including any correspondent/surveyor nomination.

Best regards,
Nova Carriers
(Claims Team)`;

  return { type: "P&I_NOTIFICATION", subject, body };
}

function draftSurveyorAppointment({ claim }) {
  const claimNumber = claim.claimNumber;
  const vessel = safe(claim.extraction?.vesselName);
  const date = safe(claim.extraction?.eventDateText);
  const loc = safe(claim.extraction?.locationText);

  const subject = buildSubject({
    claimNumber,
    vesselName: vessel,
    incident: "Survey Appointment Request",
  });

  const body = `Dear Sir/Madam,

Nova Carriers requests your attendance / appointment as surveyor in relation to the below incident.

Claim Ref: ${claimNumber}
Vessel: ${vessel}
Incident date: ${date || "TBC"}
Location: ${loc || "TBC"}

Please confirm:
1) Earliest attendance and ETA
2) Information/documents required prior attendance
3) Expected deliverables and timeline for preliminary and final report

We will provide photographs, statements, and relevant extracts upon confirmation.

Best regards,
Nova Carriers
(Claims Team)`;

  return { type: "SURVEYOR_APPOINTMENT", subject, body };
}

function draftChaseReminder({ claim, actionTitle }) {
  const claimNumber = claim.claimNumber;
  const vessel = safe(claim.extraction?.vesselName);

  const subject = buildSubject({
    claimNumber,
    vesselName: vessel,
    incident: "Follow-up / Chase",
  });

  const body = `Dear All,

Gentle reminder / follow-up in relation to Claim Ref ${claimNumber} (${vessel}).

Pending item:
- ${actionTitle}

Kindly provide an update and expected timeline for closure.

Best regards,
Nova Carriers
(Claims Team)`;

  return { type: "CHASE_REMINDER", subject, body };
}

function generateDrafts({ claim }) {
  const drafts = [];

  // Determine if P&I is a suggested cover
  const covers = (claim.classification?.covers || []).map((c) => String(c.type || "").toLowerCase());
  const isPI = covers.some((t) => t.includes("p&i"));

  if (isPI) drafts.push(draftPiNotification({ claim }));

  drafts.push(draftSurveyorAppointment({ claim }));

  // Suggest chase draft for first OPEN action (if any)
  const open = (claim.actions || []).find((a) => a.status === "OPEN");
  if (open) drafts.push(draftChaseReminder({ claim, actionTitle: open.title }));

  return drafts;
}

module.exports = {
  generateDrafts,
};
