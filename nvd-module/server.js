const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/config');
const nvdRoutes = require('./routes/nvdRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─────────────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────────────
app.use(helmet()); // Security headers
app.use(cors());   // Enable CORS for dashboard integration
app.use(express.json({ limit: '1mb' })); // Parse JSON bodies

// ─────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'NVD Intelligence Module is healthy',
    timestamp: new Date().toISOString()
  });
});

// NVD API Routes
app.use('/api/nvd', nvdRoutes);

// ─────────────────────────────────────────────────
//  ERROR HANDLING
// ─────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────
//  SERVER START
// ─────────────────────────────────────────────────
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`
  🚀 NVD Intelligence Module is running!
  📡 Port: ${PORT}
  🌍 Environment: ${config.nodeEnv}
  🔑 API Key: ${config.nvdApiKey ? 'Configured' : 'Missing (Rate limited)'}
  `);
});
