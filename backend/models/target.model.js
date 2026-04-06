/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Target Model                        ║
 * ║   Phase 2 — YE FILE ZIP MEIN NAHI THI        ║
 * ║   Seedha backend/models/ mein rakh do        ║
 * ╚══════════════════════════════════════════════╝
 */

const mongoose = require('mongoose');

// Activity log entry — ek note ka structure
const noteSchema = new mongoose.Schema({
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    source: { type: String, enum: ['user', 'system'], default: 'user' },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });

const targetSchema = new mongoose.Schema({
    // Har target ek user se linked hai
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Basic fields
    name: {
        type: String,
        required: [true, 'Target name is required'],
        trim: true,
        minlength: 2,
        maxlength: 100,
    },
    domain: {
        type: String,
        trim: true,
        default: null,
    },
    ip_address: {
        type: String,
        trim: true,
        default: null,
    },
    scope: {
        type: String,
        enum: ['in-scope', 'out-of-scope'],
        default: 'in-scope',
    },
    target_type: {
        type: String,
        enum: ['web', 'network', 'api'],
        default: 'web',
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: 500,
    },
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active',
    },

    // Legal consent — scan tab hi chalega jab ye true ho
    consentGiven: {
        type: Boolean,
        default: false,
    },

    // Tags — filter karne ke liye
    tags: {
        type: [String],
        default: [],
    },

    // Risk score — Phase 3 scan ke baad auto-calculate hoga
    riskScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },

    // Pichli baar scan kab hua
    lastScannedAt: {
        type: Date,
        default: null,
    },

    // Notes / activity log
    notes: {
        type: [noteSchema],
        default: [],
    },
}, {
    timestamps: true, // createdAt aur updatedAt auto manage hoga
});

// Fast queries ke liye indexes
targetSchema.index({ user_id: 1, status: 1 });
targetSchema.index({ user_id: 1, tags: 1 });

module.exports = mongoose.model('Target', targetSchema);