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
const Target = require('../models/target.model'); // ← PHASE 2 MEIN ADD KIA
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

        // ← PHASE 2: Real count from MongoDB
        const totalTargets = await Target.countDocuments({
            user_id: req.user.id,
            status: 'active',
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
                    totalTargets, // ← PHASE 2: real DB count (pehle 0 tha)
                    activeScans: 0,
                    criticalVulns: 0,
                    highVulns: 0,
                    mediumVulns: 0,
                    lowVulns: 0,
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
