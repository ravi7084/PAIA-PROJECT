const nvdService = require('../services/nvdService');
const scannerParserService = require('../services/scannerParserService');

/**
 * Controller for handling NVD-related requests.
 */
class NVDController {
  /**
   * Fetches data for a single CVE.
   */
  async getCVE(req, res, next) {
    try {
      const { cveId } = req.params;
      const data = await nvdService.fetchCVEData(cveId);

      if (!data) {
        return res.status(404).json({
          status: 'error',
          message: `CVE ${cveId} not found in NVD database`
        });
      }

      res.status(200).json({
        status: 'success',
        timestamp: new Date().toISOString(),
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Processes raw scanner output to extract and enrich CVEs.
   */
  async processScan(req, res, next) {
    try {
      const { scanOutput } = req.body;
      if (!scanOutput) {
        return res.status(400).json({
          status: 'error',
          message: 'No scanOutput provided in request body'
        });
      }

      const cveIds = await scannerParserService.processScan(scanOutput);
      
      if (cveIds.length === 0) {
        return res.status(200).json({
          status: 'success',
          message: 'No CVEs detected in the provided scan output',
          totalVulnerabilities: 0,
          results: []
        });
      }

      // Fetch data for all found CVEs in parallel
      const results = await Promise.all(
        cveIds.map(async (id) => {
          try {
            return await nvdService.fetchCVEData(id);
          } catch (err) {
            return { cveId: id, error: 'Failed to fetch details' };
          }
        })
      );

      // Filter out nulls (CVEs found by regex but not in NVD)
      const cleanResults = results.filter(r => r !== null);

      res.status(200).json({
        status: 'success',
        timestamp: new Date().toISOString(),
        totalVulnerabilities: cleanResults.length,
        results: cleanResults
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles bulk CVE lookups.
   */
  async bulkLookup(req, res, next) {
    try {
      const { cveIds } = req.body;
      if (!Array.isArray(cveIds)) {
        return res.status(400).json({
          status: 'error',
          message: 'cveIds must be an array'
        });
      }

      const results = await Promise.all(
        cveIds.map(id => nvdService.fetchCVEData(id).catch(() => ({ cveId: id, error: 'Lookup failed' })))
      );

      const cleanResults = results.filter(r => r !== null);

      res.status(200).json({
        status: 'success',
        timestamp: new Date().toISOString(),
        total: cleanResults.length,
        results: cleanResults
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NVDController();
