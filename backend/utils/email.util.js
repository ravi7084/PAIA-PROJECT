const nodemailer = require('nodemailer');
const logger = require('./logger');

const hasEmailConfig = () =>
  Boolean(process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS);

const safeFromAddress = () => {
  const raw = String(process.env.EMAIL_FROM || '').trim();
  if (!raw || raw.includes('mailto:') || raw.includes('[') || raw.includes(']')) {
    return 'PAIA Security <noreply@paia.dev>';
  }
  return raw;
};

const buildTransporter = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT || 587) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

const sendEmail = async ({ to, subject, text, html }) => {
  if (!hasEmailConfig()) {
    logger.warn(`Email config missing. Skipping email send to=${to} subject="${subject}"`);
    return { accepted: [], skipped: true };
  }

  const transporter = buildTransporter();
  const info = await transporter.sendMail({
    from: safeFromAddress(),
    to,
    subject,
    text,
    html
  });

  logger.info(`Email sent: messageId=${info.messageId} to=${to}`);
  return info;
};

const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresMinutes = 10 }) => {
  const subject = 'Reset your PAIA password';
  const safeName = name || 'User';
  const text = [
    `Hi ${safeName},`,
    '',
    'We received a request to reset your PAIA password.',
    `Reset link: ${resetUrl}`,
    '',
    `This link expires in ${expiresMinutes} minutes.`,
    'If you did not request this, you can safely ignore this email.'
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">PAIA Password Reset</h2>
      <p>Hi ${safeName},</p>
      <p>We received a request to reset your PAIA password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">
          Reset Password
        </a>
      </p>
      <p>This link expires in <strong>${expiresMinutes} minutes</strong>.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail
};
