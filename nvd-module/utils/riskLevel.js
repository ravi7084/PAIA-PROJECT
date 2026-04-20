/**
 * Determines the risk priority based on the CVSS score.
 * @param {number} score - CVSS score (0-10)
 * @returns {string} - Risk priority label
 */
const getRiskPriority = (score) => {
  if (score >= 9) return 'Immediate Action Required';
  if (score >= 7) return 'High Priority';
  if (score >= 4) return 'Medium Priority';
  return 'Low Priority';
};

module.exports = { getRiskPriority };
