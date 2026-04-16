/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — User Controller                     ║
 * ║   Profile management, password change        ║
 * ╚══════════════════════════════════════════════╝
 *
 * PHASE 2 CHANGES:
 *   Line 9:  Target model import add kiya
 *   Line 74: totalTargets DB se count karta hai
 *   Line 84: totalTargets: 0  →  totalTargets (real value)
 */

const User = require('../models/user.model');
const Target = require('../models/target.model');
const ReconScan = require('../models/reconScan.model'); // Added for dashboard stats
const authService = require('../services/auth.service');
const logger = require('../utils/logger');

const getProfile = async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.json({
            success: true,
            data: { user: authService.formatUser(user) },
        });
    } catch (err) {
        next(err);
    }
};

const updateProfile = async(req, res, next) => {
    try {
        const allowedFields = ['name', 'avatar'];
        const updates = {};

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        if (!Object.keys(updates).length) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        const user = await User.findByIdAndUpdate(req.user.id, updates, {
            new: true,
            runValidators: true,
        });

        logger.info(`Profile updated: ${user.email}`);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user: authService.formatUser(user) },
        });
    } catch (err) {
        next(err);
    }
};

const changePassword = async(req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        logger.info(`Password changed: ${user.email}`);

        res.json({
            success: true,
            message: 'Password changed successfully',
        });
    } catch (err) {
        next(err);
    }
};

const getDashboardStats = async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        const totalTargets = await Target.countDocuments({
            user_id: req.user.id,
            status: 'active',
        });

        // ← Real counts from MongoDB ReconScans
        const activeScans = await ReconScan.countDocuments({
            user_id: req.user.id,
            status: { $in: ['queued', 'running'] },
        });

        // Simple aggregation to count findings by severity
        const vulnCounts = await ReconScan.aggregate([
            { $match: { user_id: user._id } },
            { $unwind: '$findings' },
            { $group: { _id: '$findings.severity', count: { $sum: 1 } } },
        ]);

        const statsMap = { critical: 0, high: 0, medium: 0, low: 0 };
        vulnCounts.forEach((vc) => {
            if (statsMap[vc._id] !== undefined) statsMap[vc._id] = vc.count;
        });

        let profileCompletion = 0;
        if (user.name) profileCompletion += 40;
        if (user.email) profileCompletion += 30;
        if (user.authProvider) profileCompletion += 10;
        if (user.isEmailVerified) profileCompletion += 20;

        const securityScore = (() => {
            let score = 40;
            if (user.isEmailVerified) score += 20;
            if (user.authProvider === 'google') score += 15;
            if (user.lastLogin) score += 10;
            if (user.refreshToken) score += 15;
            return Math.min(score, 100);
        })();

        res.json({
            success: true,
            data: {
                user: authService.formatUser(user),
                stats: {
                    totalTargets,
                    activeScans,
                    criticalVulns: statsMap.critical,
                    highVulns: statsMap.high,
                    mediumVulns: statsMap.medium,
                    lowVulns: statsMap.low,
                    securityScore,
                    profileCompletion,
                    lastLoginAt: user.lastLogin,
                    emailVerified: user.isEmailVerified,
                    authProvider: user.authProvider,
                    memberSince: user.createdAt,
                    currentSession: true,
                },
            },
        });
    } catch (err) {
        next(err);
    }
};

const deleteAccount = async(req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { isActive: false });
        logger.info(`Account deactivated: ${req.user.id}`);

        res.json({
            success: true,
            message: 'Account deactivated successfully',
        });
    } catch (err) {
        next(err);
    }
};

const logoutAllDevices = async(req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { refreshToken: null });

        logger.info(`All sessions logged out: ${req.user.id}`);

        res.json({
            success: true,
            message: 'Logged out from all devices successfully',
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    getDashboardStats,
    deleteAccount,
    logoutAllDevices,
};
