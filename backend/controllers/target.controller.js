/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Target Controller                   ║
 * ║   Phase 2 — YE FILE ZIP MEIN NAHI THI        ║
 * ║   Seedha backend/controllers/ mein rakh do   ║
 * ╚══════════════════════════════════════════════╝
 */

const net = require('net'); // Node.js built-in — install nahi karna
const dns = require('dns').promises; // Node.js built-in — install nahi karna
const Target = require('../models/target.model');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────
//  SSRF PROTECTION
//  Ye ensure karta hai ki koi private/internal IP
//  ya localhost scan nahi kar sake
// ─────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
    /^localhost$/i,
    /\.local$/i,
    /\.internal$/i,
    /\.corp$/i,
    /\.home$/i,
    /\.lan$/i,
    /^metadata\.google\.internal$/i,
    /^169\.254\.169\.254$/, // AWS metadata server
    /^100\.100\.100\.200$/, // Alibaba Cloud metadata
];

// Private IP ranges — inhe scan nahi karne denge
const PRIVATE_V4_RANGES = [
    ['10.0.0.0', '10.255.255.255'], // RFC1918
    ['172.16.0.0', '172.31.255.255'], // RFC1918
    ['192.168.0.0', '192.168.255.255'], // RFC1918
    ['127.0.0.0', '127.255.255.255'], // Loopback
    ['169.254.0.0', '169.254.255.255'], // Link-local
    ['0.0.0.0', '0.255.255.255'],
    ['100.64.0.0', '100.127.255.255'],
    ['192.0.2.0', '192.0.2.255'],
    ['198.18.0.0', '198.19.255.255'],
    ['224.0.0.0', '239.255.255.255'], // Multicast
    ['240.0.0.0', '255.255.255.254'], // Reserved
    ['255.255.255.255', '255.255.255.255'], // Broadcast
];

const ip4ToInt = (ip) =>
    ip.split('.').reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0) >>> 0;

const isPrivateIP = (ip) => {
    if (net.isIPv4(ip)) {
        const n = ip4ToInt(ip);
        return PRIVATE_V4_RANGES.some(([s, e]) => n >= ip4ToInt(s) && n <= ip4ToInt(e));
    }
    if (net.isIPv6(ip)) {
        const n = ip.toLowerCase().replace(/^\[|\]$/g, '');
        return (
            n === '::1' ||
            n.startsWith('fc') || n.startsWith('fd') || ['fe8', 'fe9', 'fea', 'feb'].some(p => n.startsWith(p))
        );
    }
    return false;
};

const validateDomainFormat = (raw) => {
    const d = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (d.length > 253) return { valid: false, reason: 'Domain is too long' };
    for (const label of d.split('.')) {
        if (!label.length || label.length > 63) return { valid: false, reason: 'Invalid domain format' };
        if (!/^[a-zA-Z0-9-]+$/.test(label)) return { valid: false, reason: 'Domain has invalid characters' };
        if (label.startsWith('-') || label.endsWith('-'))
            return { valid: false, reason: 'Domain label cannot start or end with hyphen' };
    }
    return { valid: true, cleaned: d };
};

// Main SSRF check — domain aur IP dono ko validate karta hai
const checkSSRF = async(domain, ip_address) => {
    const errors = [];

    if (domain && domain.trim()) {
        const fmt = validateDomainFormat(domain.trim());
        if (!fmt.valid) {
            errors.push(fmt.reason);
        } else {
            // Known blocked patterns check
            for (const p of BLOCKED_PATTERNS) {
                if (p.test(fmt.cleaned)) {
                    errors.push('Domain is restricted (localhost/internal/reserved)');
                    break;
                }
            }
            // Agar domain ek IP hai — direct check
            if (!errors.length && net.isIP(fmt.cleaned)) {
                if (isPrivateIP(fmt.cleaned)) errors.push('IP address is private or reserved');
            }
            // DNS resolution check — DNS rebinding attack se bachata hai
            if (!errors.length && !net.isIP(fmt.cleaned)) {
                try {
                    const resolved = await Promise.race([
                        dns.resolve(fmt.cleaned),
                        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
                    ]);
                    for (const resolvedIP of resolved) {
                        if (isPrivateIP(resolvedIP)) {
                            errors.push(`Domain resolves to a private IP (${resolvedIP})`);
                            break;
                        }
                    }
                } catch (e) {
                    if (e.message !== 'timeout') {
                        // DNS fail — domain exist nahi karta, allow karo (user typo kar sakta hai)
                    }
                }
            }
        }
    }

    if (ip_address && ip_address.trim()) {
        const stripped = ip_address.trim().replace(/^\[|\]$/g, '');
        if (!net.isIP(stripped)) {
            errors.push('Invalid IP address format');
        } else if (isPrivateIP(stripped)) {
            errors.push('IP address is private or reserved — cannot scan internal networks');
        }
    }

    return errors;
};

const cleanDomain = (raw) =>
    raw ? raw.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '') : null;

// Risk score formula — Phase 3 scan ke baad call hoga
const calcRiskScore = ({ critical = 0, high = 0, medium = 0, low = 0 } = {}) =>
    Math.min(critical * 10 + high * 5 + medium * 2 + low * 1, 100);

// ─────────────────────────────────────────────────
//  CRUD OPERATIONS
// ─────────────────────────────────────────────────

// GET /api/targets
// Optional: GET /api/targets?tag=client-A  (tag se filter)
const getTargets = async(req, res, next) => {
    try {
        const filter = { user_id: req.user.id, status: 'active' };
        if (req.query.tag) filter.tags = req.query.tag;

        const targets = await Target.find(filter)
            .select('-notes') // list view mein notes nahi chahiye (heavy)
            .sort({ createdAt: -1 });

        res.json({ success: true, data: { targets, count: targets.length } });
    } catch (err) { next(err); }
};

// GET /api/targets/:id
const getTarget = async(req, res, next) => {
    try {
        const target = await Target.findOne({
            _id: req.params.id,
            user_id: req.user.id,
            status: 'active',
        });
        if (!target)
            return res.status(404).json({ success: false, message: 'Target not found' });
        res.json({ success: true, data: { target } });
    } catch (err) { next(err); }
};

// POST /api/targets
const createTarget = async(req, res, next) => {
    try {
        const { name, domain, ip_address, scope, target_type, description, consentGiven, tags } = req.body;

        // Validation
        if (!name && name.trim())
            return res.status(400).json({ success: false, message: 'Target name is required' });

        if (!domain && !ip_address)
            return res.status(400).json({ success: false, message: 'Domain or IP address is required' });

        if (!consentGiven)
            return res.status(400).json({
                success: false,
                message: 'Legal consent required — confirm you have authorization to test this target',
            });

        // SSRF check
        const ssrfErrors = await checkSSRF(domain, ip_address);
        if (ssrfErrors.length) {
            logger.warn(`SSRF blocked [create] user=${req.user.id}: ${ssrfErrors[0]}`);
            return res.status(400).json({ success: false, message: ssrfErrors[0] });
        }

        const target = await Target.create({
            user_id: req.user.id,
            name: name.trim(),
            domain: cleanDomain(domain),
            ip_address: ip_address ? ip_address.trim() : null,
            scope: scope || 'in-scope',
            target_type: target_type || 'web',
            description: description ? description.trim() : '',
            consentGiven: true,
            tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [],
            notes: [{ text: `Target "${name.trim()}" added`, source: 'system' }],
        });

        logger.info(`Target created: ${target.name} by user ${req.user.id}`);
        res.status(201).json({ success: true, data: { target } });
    } catch (err) { next(err); }
};

// PUT /api/targets/:id
const updateTarget = async(req, res, next) => {
    try {
        const { name, domain, ip_address, scope, target_type, description, tags } = req.body;

        const ssrfErrors = await checkSSRF(domain, ip_address);
        if (ssrfErrors.length) {
            logger.warn(`SSRF blocked [update] user=${req.user.id}: ${ssrfErrors[0]}`);
            return res.status(400).json({ success: false, message: ssrfErrors[0] });
        }

        const updateData = {
            name: name && name.trim(),
            domain: cleanDomain(domain),
            ip_address: ip_address ? ip_address.trim() : null,
            scope,
            target_type,
            description: description && description.trim(),
            $push: { notes: { text: 'Target details updated', source: 'system' } },
        };
        if (Array.isArray(tags)) updateData.tags = tags.map(t => t.trim()).filter(Boolean);

        const target = await Target.findOneAndUpdate({ _id: req.params.id, user_id: req.user.id, status: 'active' },
            updateData, { new: true, runValidators: true }
        );

        if (!target)
            return res.status(404).json({ success: false, message: 'Target not found' });

        logger.info(`Target updated: ${target.name} by user ${req.user.id}`);
        res.json({ success: true, data: { target } });
    } catch (err) { next(err); }
};

// DELETE /api/targets/:id  — soft delete (MongoDB se nahi hatata, status=archived karta hai)
const deleteTarget = async(req, res, next) => {
    try {
        const target = await Target.findOneAndUpdate({ _id: req.params.id, user_id: req.user.id }, {
            status: 'archived',
            $push: { notes: { text: 'Target archived', source: 'system' } },
        }, { new: true });
        if (!target)
            return res.status(404).json({ success: false, message: 'Target not found' });

        logger.info(`Target archived: ${target.name} by user ${req.user.id}`);
        res.json({ success: true, message: 'Target removed successfully' });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────
//  BULK IMPORT — POST /api/targets/bulk
//  Body: { targets: [ {name, domain, ...}, ... ] }
// ─────────────────────────────────────────────────
const bulkCreate = async(req, res, next) => {
    try {
        const { targets: rows } = req.body;

        if (!Array.isArray(rows) || !rows.length)
            return res.status(400).json({ success: false, message: 'No targets provided' });

        if (rows.length > 100)
            return res.status(400).json({ success: false, message: 'Max 100 targets per import' });

        const imported = [];
        const blocked = [];

        for (const [i, row] of rows.entries()) {
            const label = row.name || `Row ${i + 1}`;

            if (!row.name && name.trim()) {
                blocked.push({ row: i + 1, name: label, reason: 'Name required' });
                continue;
            }
            if (!row.domain && !row.ip_address) {
                blocked.push({ row: i + 1, name: label, reason: 'Domain or IP required' });
                continue;
            }

            const errors = await checkSSRF(row.domain, row.ip_address);
            if (errors.length) {
                blocked.push({ row: i + 1, name: label, reason: errors[0] });
                continue;
            }

            try {
                const t = await Target.create({
                    user_id: req.user.id,
                    name: row.name.trim(),
                    domain: cleanDomain(row.domain),
                    ip_address: row.ip_address ? row.ip_address.trim() : null,
                    scope: row.scope || 'in-scope',
                    target_type: row.target_type || 'web',
                    description: row.description ? row.description.trim() : '',
                    consentGiven: true,
                    tags: Array.isArray(row.tags) ? row.tags : [],
                    notes: [{ text: 'Imported via bulk CSV', source: 'system' }],
                });
                imported.push({ row: i + 1, name: label, id: t._id });
            } catch (e) {
                blocked.push({ row: i + 1, name: label, reason: e.message });
            }
        }

        logger.info(`Bulk import: ${imported.length} in, ${blocked.length} blocked — user ${req.user.id}`);
        res.status(201).json({
            success: true,
            data: { importedCount: imported.length, blockedCount: blocked.length, imported, blocked },
        });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────
//  SCAN HISTORY — GET /api/targets/:id/scans
//  Phase 3 ke baad yahan data aayega
// ─────────────────────────────────────────────────
const getTargetScans = async(req, res, next) => {
    try {
        const target = await Target.findOne({ _id: req.params.id, user_id: req.user.id });
        if (!target)
            return res.status(404).json({ success: false, message: 'Target not found' });

        let scans = [];
        try {
            const ScanSession = require('../models/scanSession.model');
            scans = await ScanSession.find({ target_id: req.params.id })
                .select('phase status start_time end_time createdAt')
                .sort({ createdAt: -1 })
                .limit(20);
        } catch {
            // Phase 3 model abhi nahi bana — empty array return karo
        }

        res.json({ success: true, data: { scans, count: scans.length } });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────
//  NOTES — POST /api/targets/:id/notes
//          DELETE /api/targets/:id/notes/:noteId
// ─────────────────────────────────────────────────
const addNote = async(req, res, next) => {
    try {
        const { text } = req.body;
        if (!text && text.trim())
            return res.status(400).json({ success: false, message: 'Note text is required' });

        const target = await Target.findOneAndUpdate({ _id: req.params.id, user_id: req.user.id, status: 'active' }, { $push: { notes: { text: text.trim(), source: 'user' } } }, { new: true });
        if (!target)
            return res.status(404).json({ success: false, message: 'Target not found' });

        const note = target.notes[target.notes.length - 1];
        res.status(201).json({ success: true, data: { note } });
    } catch (err) { next(err); }
};

const deleteNote = async(req, res, next) => {
    try {
        const target = await Target.findOneAndUpdate({ _id: req.params.id, user_id: req.user.id }, { $pull: { notes: { _id: req.params.noteId, source: 'user' } } }, { new: true });
        if (!target)
            return res.status(404).json({ success: false, message: 'Target not found' });
        res.json({ success: true, message: 'Note deleted' });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────
//  RISK SCORE UPDATE — PATCH /api/targets/:id/risk
//  Phase 3 scan engine yahan call karega
// ─────────────────────────────────────────────────
const updateRiskScore = async(req, res, next) => {
    try {
        const { critical = 0, high = 0, medium = 0, low = 0 } = req.body;
        const riskScore = calcRiskScore({ critical, high, medium, low });

        const target = await Target.findOneAndUpdate({ _id: req.params.id, user_id: req.user.id }, {
            riskScore,
            lastScannedAt: new Date(),
            $push: {
                notes: {
                    text: `Scan done — Risk: ${riskScore} (C:${critical} H:${high} M:${medium} L:${low})`,
                    source: 'system',
                },
            },
        }, { new: true });
        if (!target)
            return res.status(404).json({ success: false, message: 'Target not found' });

        res.json({ success: true, data: { riskScore, lastScannedAt: target.lastScannedAt } });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────
//  EXPORTS
//  checkSSRF aur calcRiskScore Phase 3 use karega
// ─────────────────────────────────────────────────
module.exports = {
    getTargets,
    getTarget,
    createTarget,
    updateTarget,
    deleteTarget,
    bulkCreate,
    getTargetScans,
    addNote,
    deleteNote,
    updateRiskScore,
    checkSSRF,
    isPrivateIP,
    calcRiskScore,
};