// ai/actions/actionGenerator.js

function baseActions() {
  return [
    { title: "Create claim file and preserve evidence", ownerRole: "Claims", dueDays: 0 },
    { title: "Confirm cover(s) and notify relevant insurers/club", ownerRole: "Claims", dueDays: 0 },
    { title: "Collect supporting documents (log extracts, photos, reports)", ownerRole: "Ops", dueDays: 1 },
    { title: "Appoint / confirm surveyor (if required)", ownerRole: "Claims", dueDays: 1 },
    { title: "Establish initial reserve (estimate) and deductible impact", ownerRole: "Finance", dueDays: 2 },
    { title: "Track updates and maintain status log", ownerRole: "Claims", dueDays: 0 },
  ];
}

function actionByCoverType(type) {
  const t = String(type || "").toLowerCase();

  if (t.includes("p&i")) {
    return [
      { title: "Identify third-party involvement and liability exposure", ownerRole: "Claims", dueDays: 1 },
      { title: "Obtain statements (Master/crew) and incident report", ownerRole: "Ops", dueDays: 1 },
      { title: "Notify relevant correspondents / local agents if needed", ownerRole: "Claims", dueDays: 1 },
    ];
  }

  if (t.includes("h&m")) {
    return [
      { title: "Obtain repair quotations and damage description", ownerRole: "Technical", dueDays: 2 },
      { title: "Confirm class requirements and temporary repairs", ownerRole: "Technical", dueDays: 1 },
    ];
  }

  if (t.includes("charterers")) {
    return [
      { title: "Review charterparty clauses for liabilities/insurance obligations", ownerRole: "Chartering", dueDays: 1 },
      { title: "Collect SOF/NOA/NOR and terminal correspondence", ownerRole: "Ops", dueDays: 2 },
    ];
  }

  if (t.includes("fd&d")) {
    return [
      { title: "Summarise dispute issues and relevant contract clauses", ownerRole: "Claims", dueDays: 2 },
      { title: "Prepare chronology and evidence pack for legal review", ownerRole: "Claims", dueDays: 3 },
    ];
  }

  return [];
}

function generateActions({ covers = [] }) {
  const actions = [...baseActions()];

  for (const c of covers) {
    actions.push(...actionByCoverType(c.type));
  }

  // De-duplicate by title
  const seen = new Set();
  const deduped = [];
  for (const a of actions) {
    const key = a.title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(a);
    }
  }

  return deduped;
}

module.exports = {
  generateActions,
};
