const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const reportRoutes = require('./routes/reportRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─────────────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Higher limit for raw logs

// Static serving for the dashboard if needed
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// ─────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Report Module is healthy',
    timestamp: new Date().toISOString()
  });
});

// Report API Routes
app.use('/api/report', reportRoutes);

// ─────────────────────────────────────────────────
//  ERROR HANDLING
// ─────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────
//  SERVER START
// ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`
  📄 Security Report Module is active!
  📡 Port: ${PORT}
  🌍 Environment: ${process.env.NODE_ENV || 'development'}
  📂 Storage: ${path.join(__dirname, 'reports')}
  `);
});
