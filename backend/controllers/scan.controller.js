const axios = require('axios');
const Scan = require('../models/scan.model');
const logger = require('../utils/logger');

/**
 * Starts a scan by calling the Kali API
 */
exports.startScan = async (req, res) => {
  try {
    const { target, type } = req.body;

    if (!target || !type) {
      return res.status(400).json({ success: false, message: 'Target and Type are required' });
    }

    // 1. Create scan entry in DB
    const newScan = new Scan({
      target,
      type,
      status: 'running'
    });
    await newScan.save();

    // 2. Determine Kali Endpoint
    const KALI_IP = process.env.REMOTE_SCANNER_IP || '127.0.0.1';
    let kaliEndpoint = '';
    
    if (type === 'network') kaliEndpoint = `http://${KALI_IP}:5000/nmap`;
    else if (type === 'subdomain') kaliEndpoint = `http://${KALI_IP}:5000/subfinder`;
    else if (type === 'webapp') kaliEndpoint = `http://${KALI_IP}:5000/nikto`;
    else if (type === 'recon') kaliEndpoint = `http://${KALI_IP}:5000/recon`;
    else {
      return res.status(400).json({ success: false, message: 'Invalid scan type' });
    }

    // 3. Call Kali API (async - don't wait for scan to finish if you want to poll)
    // However, to make it robust, we wrap the call.
    // Optimization: We run the axios call in the background and update the DB when done.
    
    logger.info(`Orchestrating ${type} scan for ${target} at ${kaliEndpoint}`);
    
    axios.post(kaliEndpoint, { target })
      .then(async (response) => {
        await Scan.findByIdAndUpdate(newScan._id, {
          status: 'completed',
          result: response.data,
          finishedAt: new Date()
        });
        logger.info(`${type} scan for ${target} completed successfully`);
      })
      .catch(async (error) => {
        logger.error(`Kali API Error for ${type} scan: ${error.message}`);
        await Scan.findByIdAndUpdate(newScan._id, {
          status: 'failed',
          result: { error: error.message },
          finishedAt: new Date()
        });
      });

    // 4. Return the scanId immediately for the frontend to start polling
    res.status(201).json({
      success: true,
      scanId: newScan._id,
      message: `${type} scan started for ${target}`
    });

  } catch (error) {
    logger.error(`Start Scan Controller Error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Gets a specific scan by ID
 */
exports.getScanById = async (req, res) => {
  try {
    const scan = await Scan.findById(req.params.id);
    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan not found' });
    }
    res.status(200).json({ success: true, data: scan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Gets all scans (optionally filtered by type)
 */
exports.getAllScans = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = type ? { type } : {};
    const scans = await Scan.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: scans.length, data: scans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
