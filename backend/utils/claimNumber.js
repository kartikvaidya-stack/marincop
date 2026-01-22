// backend/utils/claimNumber.js
const { v4: uuidv4 } = require("uuid");

/**
 * Claim number format:
 * MC-NOVA-YYYY-0001 (incrementing per year)
 *
 * We also create an internal immutable ID (UUID) for database integrity.
 */
function createInternalId() {
  return uuidv4();
}

function formatSequence(n) {
  return String(n).padStart(4, "0");
}

function buildClaimNumber({ companyCode = "NOVA", year, seq }) {
  return `MC-${companyCode}-${year}-${formatSequence(seq)}`;
}

module.exports = {
  createInternalId,
  buildClaimNumber,
};
