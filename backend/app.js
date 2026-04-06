/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Express App                         ║
 * ║   Middleware, routes, error handling         ║
 * ╚══════════════════════════════════════════════╝
 *
 * PHASE 2 CHANGE: Line 67 mein target route add kiya
 * Baaki sab original zip jaisa hai
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const passport = require('passport');

require('./config/passport');

const app = express();

// ─────────────────────────────────────────────────
//  SECURITY MIDDLEWARE
// ─────────────────────────────────────────────────

app.use(helmet());

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Global rate limit — 100 requests per 15 min
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests. Please try again later.' },
}));

// Stricter rate limit on auth endpoints — 10 per 15 min
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use('/api/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));

// ─────────────────────────────────────────────────
//  BODY PARSING
// ─────────────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────
//  LOGGING & PASSPORT
// ─────────────────────────────────────────────────

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

app.use(passport.initialize());

// ─────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────

app.use('/api/recon', require('./routes/recon.routes')); //reconaissance routes

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/user', require('./routes/user.routes'));
app.use('/api/targets', require('./routes/target.routes')); // ← PHASE 2 MEIN YE LINE ADD KI

// Health check endpoint
app.get('/api/health', (req, res) =>
    res.json({
        success: true,
        message: 'PAIA API is running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    })
);

// ─────────────────────────────────────────────────
//  ERROR HANDLING
// ─────────────────────────────────────────────────

// 404 — Route not found
app.use((req, res) =>
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
    })
);

// Global error handler
app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

module.exports = app;