/**
 * Extracts CVE IDs from a raw string using regex.
 * @param {string} text - The raw text output from a scanner.
 * @returns {string[]} - Array of unique CVE IDs.
 */
const extractCVE = (text) => {
  if (!text || typeof text !== 'string') return [];
  
  const cveRegex = /CVE-\d{4}-\d{4,7}/g;
  const matches = text.match(cveRegex);
  
  // Return unique matches only
  return matches ? [...new Set(matches)] : [];
};

module.exports = { extractCVE };
