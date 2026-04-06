const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const sessionSchema = new mongoose.Schema(
  {
    refreshToken: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: '',
    },
    ip: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: 'Unknown location',
    },
    browser: {
      type: String,
      default: 'Unknown Browser',
    },
    os: {
      type: String,
      default: 'Unknown OS',
    },
    device: {
      type: String,
      default: 'Unknown Device',
    },
    connection: {
      type: String,
      default: 'Authenticated session',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    googleId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    password: {
      type: String,
      select: false,
      minlength: 8,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },

    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    sessions: {
      type: [sessionSchema],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function savePassword(next) {
  if (!this.isModified('password') || !this.password) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }

  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function changedPasswordAfter(JWTTimestamp) {
  if (!this.passwordChangedAt) return false;

  const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
  return JWTTimestamp < changedTimestamp;
};

userSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const minutes = parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || '10', 10);
  this.passwordResetExpires = new Date(Date.now() + minutes * 60 * 1000);
  return resetToken;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
