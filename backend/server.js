/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Server Entry Point                  ║
 * ║   HTTP server + Socket.io init               ║
 * ╚══════════════════════════════════════════════╝
 */

const path = require('path');
const envPath = path.join(__dirname, '.env');
const result = require('dotenv').config({ path: envPath });
console.log('--- DEBUG: Dotenv Load ---');
console.log('Env Path:', envPath);
if (result.error) console.log('Wait Dotenv Error:', result.error);
console.log('MONGO_URI loaded:', !!process.env.MONGO_URI);
console.log('--------------------------');

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// ── Connect to MongoDB ────────────────────────────
connectDB();

// ── Create HTTP server ────────────────────────────
const server = http.createServer(app);

// ── Socket.io — used in Phase 3 for live scan updates
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
    },
});

// Make io accessible inside controllers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join a scan room — used in Phase 3
    socket.on('join_scan', (scanId) => {
        if (!scanId) return;
        socket.join(`scan_${scanId}`);
        logger.info(`Socket ${socket.id} joined scan: ${scanId}`);
    });

    socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
    });
});

// ── Start server ──────────────────────────────────
server.listen(PORT, () => {
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`  PAIA Backend running`);
    logger.info(`  Port:    ${PORT}`);
    logger.info(`  Mode:    ${process.env.NODE_ENV}`);
    logger.info(`  Health:  http://localhost:${PORT}/api/health`);
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

// ── Handle crashes gracefully ─────────────────────
process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`);
    process.exit(1);
});
