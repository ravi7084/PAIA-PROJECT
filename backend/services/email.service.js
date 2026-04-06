/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Email Service                       ║
 * ║   Password reset + email verification        ║
 * ╚══════════════════════════════════════════════╝
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user.model');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────

const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

const generateToken = () =>
    crypto.randomBytes(32).toString('hex');

// ─────────────────────────────────────────────────
//  NODEMAILER TRANSPORTER
// ─────────────────────────────────────────────────

const createTransporter = () =>
    nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

// ─────────────────────────────────────────────────
//  SEND EMAIL
// ─────────────────────────────────────────────────

const sendEmail = async({ to, subject, html }) => {
    try {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'PAIA <noreply@paia.dev>',
            to,
            subject,
            html,
        });
        logger.info(`Email sent → ${to} | ${subject}`);
    } catch (err) {
        // Log but don't crash — email failure shouldn't stop the app
        logger.error(`Email failed → ${err.message}`);
        if (process.env.NODE_ENV === 'development') {
            logger.debug(`[EMAIL CONTENT]\n${html}`);
        }
    }
};

// ─────────────────────────────────────────────────
//  PASSWORD RESET
// ─────────────────────────────────────────────────

const sendPasswordResetEmail = async(user) => {
    const token = generateToken();

    // Save hashed token + expiry to DB
    user.passwordResetToken = hashToken(token);
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    await sendEmail({
        to: user.email,
        subject: 'PAIA — Reset Your Password',
        html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:480px;margin:0 auto;background:#0e0e1c;border-radius:16px;padding:32px;color:#f1f0ff">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
          <div style="width:36px;height:36px;background:#4f46e5;border-radius:8px;display:flex;align-items:center;justify-content:center">
            <span style="color:#fff;font-size:18px;font-weight:800">P</span>
          </div>
          <span style="font-size:16px;font-weight:800;color:#f1f0ff">PAIA</span>
        </div>

        <h2 style="font-size:20px;font-weight:700;color:#f1f0ff;margin-bottom:8px">Reset your password</h2>
        <p style="color:#9490b5;font-size:14px;line-height:1.6;margin-bottom:24px">
          Hi ${user.name}, we received a request to reset your password. Click the button below to choose a new one.
        </p>

        <a href="${resetURL}"
           style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:24px">
          Reset Password
        </a>

        <p style="color:#5a5680;font-size:12px;line-height:1.6">
          This link expires in <strong style="color:#9490b5">10 minutes</strong>.<br>
          If you did not request this, you can safely ignore this email.
        </p>

        <div style="border-top:1px solid #1e1e3a;margin-top:24px;padding-top:16px">
          <p style="color:#5a5680;font-size:11px">PAIA — Penetration Testing AI Agent</p>
        </div>
      </div>
    `,
    });
};

const resetPasswordWithToken = async(token, newPassword) => {
    const user = await User.findOne({
        passwordResetToken: hashToken(token),
        passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
        const err = new Error('Reset link is invalid or has expired');
        err.statusCode = 400;
        throw err;
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info(`Password reset: ${user.email}`);
    return user;
};

// ─────────────────────────────────────────────────
//  EMAIL VERIFICATION
// ─────────────────────────────────────────────────

const sendVerificationEmail = async(user) => {
    const token = generateToken();

    user.emailVerifyToken = hashToken(token);
    user.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save({ validateBeforeSave: false });

    const verifyURL = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    await sendEmail({
        to: user.email,
        subject: 'PAIA — Verify Your Email',
        html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:480px;margin:0 auto;background:#0e0e1c;border-radius:16px;padding:32px;color:#f1f0ff">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
          <div style="width:36px;height:36px;background:#4f46e5;border-radius:8px;display:flex;align-items:center;justify-content:center">
            <span style="color:#fff;font-size:18px;font-weight:800">P</span>
          </div>
          <span style="font-size:16px;font-weight:800;color:#f1f0ff">PAIA</span>
        </div>

        <h2 style="font-size:20px;font-weight:700;color:#f1f0ff;margin-bottom:8px">Verify your email</h2>
        <p style="color:#9490b5;font-size:14px;line-height:1.6;margin-bottom:24px">
          Hi ${user.name}, welcome to PAIA! Click below to verify your email address.
        </p>

        <a href="${verifyURL}"
           style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:24px">
          Verify Email
        </a>

        <p style="color:#5a5680;font-size:12px">This link expires in 24 hours.</p>

        <div style="border-top:1px solid #1e1e3a;margin-top:24px;padding-top:16px">
          <p style="color:#5a5680;font-size:11px">PAIA — Penetration Testing AI Agent</p>
        </div>
      </div>
    `,
    });
};

const verifyEmailWithToken = async(token) => {
    const user = await User.findOne({
        emailVerifyToken: hashToken(token),
        emailVerifyExpires: { $gt: Date.now() },
    });

    if (!user) {
        const err = new Error('Verification link is invalid or has expired');
        err.statusCode = 400;
        throw err;
    }

    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.info(`Email verified: ${user.email}`);
    return user;
};

module.exports = {
    sendPasswordResetEmail,
    resetPasswordWithToken,
    sendVerificationEmail,
    verifyEmailWithToken,
};