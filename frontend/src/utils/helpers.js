/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Helper Utilities                    ║
 * ╚══════════════════════════════════════════════╝
 */

/** Format ISO date → "Mar 19, 2026" */
export const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

/** Time ago → "2 hours ago" */
export const timeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  const units = [
    { name: 'year',   value: 31536000 },
    { name: 'month',  value: 2592000  },
    { name: 'week',   value: 604800   },
    { name: 'day',    value: 86400    },
    { name: 'hour',   value: 3600     },
    { name: 'minute', value: 60       },
  ];
  for (const { name, value } of units) {
    const count = Math.floor(seconds / value);
    if (count >= 1) return `${count} ${name}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
};

/** Get user initials from name */
export const getInitials = (name = '') =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

/** CVSS score → severity label */
export const cvssToSeverity = (score) => {
  if (score === 0)    return 'None';
  if (score < 4)      return 'Low';
  if (score < 7)      return 'Medium';
  if (score < 9)      return 'High';
  return 'Critical';
};

/** CVSS score → color class */
export const cvssToColor = (score) => {
  if (score === 0) return 'var(--text3)';
  if (score < 4)   return '#6ee7b7';
  if (score < 7)   return '#fcd34d';
  if (score < 9)   return '#fb923c';
  return '#f87171';
};

/** Truncate long strings */
export const truncate = (str = '', max = 40) =>
  str.length > max ? `${str.slice(0, max)}...` : str;

/** Validate IP address */
export const isValidIP = (ip) =>
  /^(25[0-5]|2[0-4]\d|[01]?\d\d?)(\.(25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/.test(ip);

/** Validate domain name */
export const isValidDomain = (domain) =>
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain);

/** Validate URL */
export const isValidURL = (url) => {
  try { new URL(url); return true; } catch { return false; }
};

/** Password strength score (0-4) */
export const getPasswordStrength = (pw = '') => {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))   score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

/** Password strength color */
export const strengthColor = (score) => {
  const colors = ['rgba(255,255,255,0.06)', '#ef4444', '#f59e0b', '#a3e635', '#10b981'];
  return colors[score] || colors[0];
};