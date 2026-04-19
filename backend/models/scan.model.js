const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
  target: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['network', 'subdomain', 'webapp', 'recon'],
    required: true
  },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed'],
    default: 'running'
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  finishedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Scan', scanSchema);
