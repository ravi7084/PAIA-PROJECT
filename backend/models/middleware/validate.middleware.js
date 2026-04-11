/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Validation Middleware               ║
 * ║   Joi schemas for all request bodies         ║
 * ╚══════════════════════════════════════════════╝
 */

const Joi = require('joi');

// ─────────────────────────────────────────────────
//  GENERIC VALIDATOR FACTORY
// ─────────────────────────────────────────────────

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors:  error.details.map((d) => ({
        field:   d.path[0],
        message: d.message.replace(/"/g, ''),
      })),
    });
  }
  next();
};

// ─────────────────────────────────────────────────
//  SHARED RULES
// ─────────────────────────────────────────────────

const passwordRule = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .required()
  .messages({
    'string.min':          'Password must be at least 8 characters',
    'string.pattern.base': 'Password must contain uppercase, lowercase and a number',
    'any.required':        'Password is required',
  });

// ─────────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────────

const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      'string.min':   'Name must be at least 2 characters',
      'any.required': 'Name is required',
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Enter a valid email address',
      'any.required': 'Email is required',
    }),
    password: passwordRule,
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({ 'any.only': 'Passwords do not match', 'any.required': 'Please confirm your password' }),
  }),

  login: Joi.object({
    email:    Joi.string().email().required().messages({ 'any.required': 'Email is required' }),
    password: Joi.string().required().messages({ 'any.required': 'Password is required' }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Enter a valid email address',
      'any.required': 'Email is required',
    }),
  }),

  resetPassword: Joi.object({
    token:       Joi.string().required().messages({ 'any.required': 'Reset token is required' }),
    newPassword: passwordRule,
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({ 'any.required': 'Current password is required' }),
    newPassword:     passwordRule,
  }),

  updateProfile: Joi.object({
    name:   Joi.string().min(2).max(50).optional(),
    avatar: Joi.string().uri().optional().allow('', null),
  }),
};

module.exports = { validate, schemas };