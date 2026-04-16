const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SERVER_SESSION_ID = crypto.randomBytes(16).toString('hex');

const signAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'access', sid: SERVER_SESSION_ID },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

const signRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh', sid: SERVER_SESSION_ID },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  if (decoded.sid !== SERVER_SESSION_ID) {
    throw new jwt.JsonWebTokenError('Token is no longer valid for this server session');
  }
  return decoded;
};

const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  if (decoded.sid !== SERVER_SESSION_ID) {
    throw new jwt.JsonWebTokenError('Token is no longer valid for this server session');
  }
  return decoded;
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  authProvider: user.authProvider,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive,
  avatar: user.avatar || '',
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  formatUser,
};
