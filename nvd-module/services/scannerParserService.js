const { extractCVE } = require('../utils/parser');

/**
 * Service to process raw scanner output.
 */
class ScannerParserService {
  /**
   * Processes raw text to identify and return CVE information.
   * @param {string} scanOutput - Raw scanner terminal output.
   * @returns {string[]} - List of found CVE IDs.
   */
  async processScan(scanOutput) {
    if (!scanOutput) return [];
    return extractCVE(scanOutput);
  }
}

module.exports = new ScannerParserService();
