// backend/utils/audit.js

function auditEntry({ by, action, note }) {
  return {
    at: new Date().toISOString(),
    by: by || "system",
    action,
    note: note || "",
  };
}

module.exports = {
  auditEntry,
};
