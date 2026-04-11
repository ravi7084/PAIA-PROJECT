/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Winston Logger                      ║
 * ║   Logs to console + file simultaneously      ║
 * ╚══════════════════════════════════════════════╝
 */

const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

// ── Ensure logs/ directory exists ────────────────
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ── Custom log format ─────────────────────────────
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    const msg = `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}`;
    return stack ? `${msg}\n${stack}` : msg;
  })
);

const colorizedFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) =>
    `${timestamp} ${level} ${message}`
  )
);

// ── Create logger instance ────────────────────────
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // Console — colorized, short timestamp
    new winston.transports.Console({ format: colorizedFormat }),

    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level:    'error',
      maxsize:  5 * 1024 * 1024, // 5MB
      maxFiles: 3,
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize:  10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;