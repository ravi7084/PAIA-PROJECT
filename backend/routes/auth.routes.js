const router = require('express').Router();

const ctrl = require('../controllers/auth.controller');
const { protect } = require('../models/middleware/auth.middleware');
const { validate, schemas } = require('../models/middleware/validate.middleware');
const { passport, isGoogleOAuthConfigured } = require('../config/passport');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/forgot-password', validate(schemas.forgotPassword), ctrl.forgotPassword);
router.patch('/reset-password', validate(schemas.resetPassword), ctrl.resetPassword);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', protect, ctrl.me);
router.get('/google/status', ctrl.googleAvailability);

router.get('/google', (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_unavailable`);
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!isGoogleOAuthConfigured) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_unavailable`);
    }

    return passport.authenticate('google', {
      session: false,
      failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_failed`,
    })(req, res, next);
  },
  ctrl.googleCallback
);

module.exports = router;
