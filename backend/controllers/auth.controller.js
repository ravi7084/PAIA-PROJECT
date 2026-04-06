const User = require('../models/user.model');
const authService = require('../services/auth.service');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/email.util');
const { isGoogleOAuthConfigured } = require('../config/passport');

const register = async(req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered',
            });
        }

        const user = await User.create({
            name,
            email,
            password,
            authProvider: 'local',
            isEmailVerified: false,
        });

        const accessToken = authService.signAccessToken(user._id);
        const refreshToken = authService.signRefreshToken(user._id);

        user.refreshToken = refreshToken;
        user.lastLogin = new Date();
        await user.save();

        logger.info(`User registered: ${user.email}`);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: authService.formatUser(user),
                accessToken,
                refreshToken,
            },
        });
    } catch (err) {
        next(err);
    }
};

const login = async(req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email, isActive: true }).select('+password +refreshToken');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        if (user.authProvider !== 'local') {
            return res.status(400).json({
                success: false,
                message: `This account uses ${user.authProvider} sign-in`,
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        const accessToken = authService.signAccessToken(user._id);
        const refreshToken = authService.signRefreshToken(user._id);

        user.refreshToken = refreshToken;
        user.lastLogin = new Date();
        await user.save();

        logger.info(`User logged in: ${user.email}`);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: authService.formatUser(user),
                accessToken,
                refreshToken,
            },
        });
    } catch (err) {
        next(err);
    }
};

const refresh = async(req, res, next) => {
    try {
        const incomingRefreshToken = req.body && req.body.refreshToken;

        if (!incomingRefreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token is required',
            });
        }

        const decoded = authService.verifyRefreshToken(incomingRefreshToken);

        const user = await User.findById(decoded.id).select('+refreshToken');
        if (!user || user.refreshToken !== incomingRefreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token',
            });
        }

        const accessToken = authService.signAccessToken(user._id);
        const newRefreshToken = authService.signRefreshToken(user._id);

        user.refreshToken = newRefreshToken;
        await user.save();

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken,
                refreshToken: newRefreshToken,
            },
        });
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token',
        });
    }
};

const logout = async(req, res, next) => {
    try {
        const incomingRefreshToken = req.body && req.body.refreshToken;

        if (!incomingRefreshToken) {
            return res.json({
                success: true,
                message: 'Logged out successfully',
            });
        }

        let decoded;
        try {
            decoded = authService.verifyRefreshToken(incomingRefreshToken);
        } catch {
            return res.json({
                success: true,
                message: 'Logged out successfully',
            });
        }

        const user = await User.findById(decoded.id).select('+refreshToken');
        if (user && user.refreshToken === incomingRefreshToken) {
            user.refreshToken = null;
            await user.save();
            logger.info(`User logged out: ${user.email}`);
        }

        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (err) {
        next(err);
    }
};

const me = async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.json({
            success: true,
            data: {
                user: authService.formatUser(user),
            },
        });
    } catch (err) {
        next(err);
    }
};

const googleAvailability = (req, res) => {
    if (isGoogleOAuthConfigured) {
        return res.json({
            success: true,
            message: 'Google sign-in is available',
        });
    }

    return res.status(503).json({
        success: false,
        message: 'Google sign-in is not configured on the server',
    });
};

const googleCallback = async(req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
        }

        const accessToken = authService.signAccessToken(req.user._id);
        const refreshToken = authService.signRefreshToken(req.user._id);

        req.user.refreshToken = refreshToken;
        req.user.lastLogin = new Date();
        await req.user.save({ validateBeforeSave: false });

        const redirectUrl = new URL('/auth/callback', process.env.CLIENT_URL || 'http://localhost:3000');
        redirectUrl.searchParams.set('accessToken', accessToken);
        redirectUrl.searchParams.set('refreshToken', refreshToken);

        logger.info(`Google login successful: ${req.user.email}`);
        return res.redirect(redirectUrl.toString());
    } catch (err) {
        return next(err);
    }
};

const forgotPassword = async(req, res, next) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const genericResponse = {
            success: true,
            message: 'If this email is registered, a password reset link has been sent.'
        };

        if (!email) return res.json(genericResponse);

        const user = await User.findOne({ email, isActive: true }).select('+passwordResetToken +passwordResetExpires');
        if (!user || user.authProvider !== 'local') {
            return res.json(genericResponse);
        }

        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;
        const expiresMinutes = parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || '10', 10);

        try {
            await sendPasswordResetEmail({
                to: user.email,
                name: user.name,
                resetUrl,
                expiresMinutes
            });
        } catch (mailErr) {
            user.passwordResetToken = null;
            user.passwordResetExpires = null;
            await user.save({ validateBeforeSave: false });
            logger.error(`Password reset email failed for ${user.email}: ${mailErr.message}`);
            return res.status(500).json({
                success: false,
                message: 'Unable to send reset email right now. Please try again later.'
            });
        }

        logger.info(`Password reset email sent to ${user.email}`);
        return res.json(genericResponse);
    } catch (err) {
        next(err);
    }
};

const resetPassword = async(req, res, next) => {
    try {
        const token = String(req.body?.token || '').trim();
        const newPassword = String(req.body?.newPassword || '');

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() },
            isActive: true
        }).select('+password +refreshToken +passwordResetToken +passwordResetExpires');

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        user.password = newPassword;
        user.passwordResetToken = null;
        user.passwordResetExpires = null;

        const accessToken = authService.signAccessToken(user._id);
        const refreshToken = authService.signRefreshToken(user._id);
        user.refreshToken = refreshToken;
        user.lastLogin = new Date();
        await user.save();

        logger.info(`Password reset successful: ${user.email}`);
        return res.json({
            success: true,
            message: 'Password reset successful',
            data: {
                user: authService.formatUser(user),
                accessToken,
                refreshToken
            }
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword,
    refresh,
    logout,
    me,
    googleAvailability,
    googleCallback,
};
