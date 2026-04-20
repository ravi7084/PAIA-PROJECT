/**
 * Risk Scoring Logic
 * ≥ 9 → Critical
 * ≥ 7 → High
 * ≥ 4 → Medium
 * else → Low
 */
const getSeverityInfo = (score) => {
  const s = parseFloat(score);
  if (s >= 9) return { label: 'Critical', color: '#dc2626' }; // Red-600
  if (s >= 7) return { label: 'High', color: '#ea580c' };     // Orange-600
  if (s >= 4) return { label: 'Medium', color: '#ca8a04' };   // Yellow-600
  return { label: 'Low', color: '#16a34a' };               // Green-600
};

const getRiskPriority = (score) => {
  const s = parseFloat(score);
  if (s >= 9) return 'Immediate Action Required';
  if (s >= 7) return 'High Priority';
  if (s >= 4) return 'Medium Priority';
  return 'Low Priority';
};

module.exports = { getSeverityInfo, getRiskPriority };
