const express = require('express');
const bcrypt = require('bcryptjs');
const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { setAuthTokens } = require('~/server/services/AuthService');
const { findUser, createUser } = require('~/models');

const router = express.Router();

/**
 * SSO Authentication Route
 * Accepts a Supabase access token, verifies it against Supabase,
 * finds or creates the user in LibreChat's MongoDB, and issues
 * LibreChat JWT tokens.
 *
 * POST /api/auth/sso
 * Body: { access_token: string }
 */
router.post('/', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ message: 'Missing access_token' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      logger.error('[SSO] SUPABASE_URL not configured');
      return res.status(500).json({ message: 'SSO not configured' });
    }

    // Verify the Supabase token by calling Supabase's /auth/v1/user endpoint
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
      },
    });

    if (!userResponse.ok) {
      logger.warn('[SSO] Invalid Supabase token');
      return res.status(401).json({ message: 'Invalid SSO token' });
    }

    const supabaseUser = await userResponse.json();
    const email = supabaseUser.email;
    const name =
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      email?.split('@')[0] ||
      'User';

    if (!email) {
      return res.status(400).json({ message: 'No email found in SSO token' });
    }

    // Find or create user in LibreChat's MongoDB
    let user = await findUser({ email });

    if (!user) {
      logger.info(`[SSO] Creating new user for: ${email}`);
      const salt = bcrypt.genSaltSync(10);
      // Generate a random password since SSO users don't need one
      const randomPassword = require('node:crypto').randomBytes(32).toString('hex');

      user = await createUser(
        {
          provider: 'sso',
          email,
          username: email.split('@')[0],
          name,
          avatar: null,
          role: SystemRoles.USER,
          password: bcrypt.hashSync(randomPassword, salt),
          emailVerified: true,
        },
        undefined,
        true,
        true,
      );
    }

    // Issue LibreChat JWT tokens
    const token = await setAuthTokens(user._id, res);

    logger.info(`[SSO] Login successful for: ${email}`);
    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (err) {
    logger.error('[SSO] Error:', err);
    return res.status(500).json({ message: 'SSO authentication failed' });
  }
});

module.exports = router;
