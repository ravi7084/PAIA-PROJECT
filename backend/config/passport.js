const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user.model');
const logger = require('../utils/logger');

const hasRealGoogleConfig = (value, placeholder) =>
  Boolean(value) && value !== placeholder;

const isGoogleOAuthConfigured = (
  hasRealGoogleConfig(process.env.GOOGLE_CLIENT_ID, 'your_real_google_client_id') &&
  hasRealGoogleConfig(process.env.GOOGLE_CLIENT_SECRET, 'your_real_google_client_secret') &&
  Boolean(process.env.GOOGLE_CALLBACK_URL)
);

if (!isGoogleOAuthConfigured) {
  logger.warn('Google OAuth is disabled because GOOGLE_* environment variables are missing.');
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const avatar = profile.photos?.[0]?.value || '';

          if (!email) {
            return done(new Error('Google account email is not available.'), null);
          }

          let user = await User.findOne({ googleId: profile.id });
          if (user) {
            user.lastLogin = new Date();
            if (!user.avatar && avatar) user.avatar = avatar;
            await user.save({ validateBeforeSave: false });
            logger.info(`Google login: ${user.email}`);
            return done(null, user);
          }

          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            user.authProvider = 'google';
            user.isEmailVerified = true;
            user.isActive = true;
            user.lastLogin = new Date();
            if (!user.avatar && avatar) user.avatar = avatar;
            await user.save({ validateBeforeSave: false });
            logger.info(`Google linked to existing account: ${email}`);
            return done(null, user);
          }

          user = await User.create({
            googleId: profile.id,
            name: profile.displayName || email.split('@')[0],
            email,
            avatar,
            isEmailVerified: true,
            authProvider: 'google',
            lastLogin: new Date(),
          });

          logger.info(`New user via Google: ${email}`);
          return done(null, user);
        } catch (err) {
          logger.error(`Google OAuth error: ${err.message}`);
          return done(err, null);
        }
      }
    )
  );
}

module.exports = {
  passport,
  isGoogleOAuthConfigured,
};
