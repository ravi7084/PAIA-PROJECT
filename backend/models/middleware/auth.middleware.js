/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Auth Middleware                     ║
 * ║   JWT verification + role-based access       ║
 * ╚══════════════════════════════════════════════╝
 */

const { verifyAccessToken } = require('../../services/auth.service');
const User = require('../user.model');

const extractAccessToken = (req) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const headerCandidates = [
        authHeader,
        req.headers['x-access-token'],
        req.headers['x-auth-token'],
        req.headers.token,
    ];

    for (const headerValue of headerCandidates) {
        if (!headerValue || typeof headerValue !== 'string') continue;

        const trimmed = headerValue.trim();
        if (!trimmed) continue;

        const bearerMatch = trimmed.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch && bearerMatch[1]) return bearerMatch[1].trim();

        // Allow passing the JWT directly for clients that do not prepend "Bearer".
        return trimmed;
    }

    return null;
};

const protect = async(req, res, next) => {
    try {
        const token = extractAccessToken(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Please login to continue.',
            });
        }

        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (err) {
            const message = err.name === 'TokenExpiredError' ?
                'Session expired. Please login again.' :
                'Invalid token. Please login again.';
            return res.status(401).json({ success: false, message });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ success: false, message: 'User no longer exists.' });
        }
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
        }

        req.user = {
            id: user._id.toString(),
            role: user.role,
            email: user.email,
        };

        next();
    } catch (err) {
        next(err);
    }
};

const restrictTo = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to perform this action.',
        });
    }
    next();
};

module.exports = { protect, restrictTo };
