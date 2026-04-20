require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  nvdApiKey: process.env.NVD_API_KEY || null,
  nodeEnv: process.env.NODE_ENV || 'development',
  nvdBaseUrl: 'https://services.nvd.nist.gov/rest/json/cves/2.0'
};

module.exports = config;
