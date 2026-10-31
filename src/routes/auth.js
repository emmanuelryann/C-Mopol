import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/user.js';
import Session from '../models/session.js';
import { authenticate } from '../middlewares/auth.js';
import {
  validate,
  createUser,
  loginUser,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../middlewares/validation.js';

const router = Router();
const MAX_SESSIONS = 2;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Token Helpers ───────────────────────────────────────────────

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generateAccessToken = (userId, sessionId) => {
  return jwt.sign(
    { id: String(userId), sid: String(sessionId) },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' },
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: String(userId) }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
    jwtid: crypto.randomUUID(),
  });
};

const setCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: SESSION_DURATION_MS, // 7 days
  });
};

// ── Session Helpers ─────────────────────────────────────────────

/**
 * Compute a device fingerprint.
 * 1. Honors explicit client device ID if provided (header `x-device-id` or body `deviceId`).
 * 2. Otherwise derives fingerprint from client IP + OS/Platform signature extracted from User-Agent.
 *    On the same device, different browsers (Chrome, Firefox, Safari) and tabs share the same (IP + OS/Platform),
 *    ensuring they resolve to the same deviceId.
 */
const computeDeviceId = (req) => {
  const explicitId = req.headers['x-device-id'] || req.body?.deviceId;
  if (explicitId && typeof explicitId === 'string' && explicitId.trim()) {
    return crypto.createHash('sha256').update(explicitId.trim()).digest('hex');
  }

  const ip = req.ip || req.connection?.remoteAddress || 'unknown-ip';
  const userAgent = req.headers['user-agent'] || 'unknown-agent';

  // Extract OS/Platform (content inside first parentheses, e.g. "Macintosh; Intel Mac OS X 10_15_7")
  const osMatch = userAgent.match(/\(([^)]+)\)/);
  const platform = osMatch ? osMatch[1].trim() : userAgent.trim();

  return crypto.createHash('sha256').update(`${ip}::${platform}`).digest('hex');
};

/**
 * Create a new session or replace an existing one for the same device.
 * Enforces:
 * - Exactly one session per user per device (logging in from a different browser/tab on the same device replaces and revokes the previous session).
 * - Maximum of 2 sessions in total across different devices.
 *
 * @param {ObjectId} userId
 * @param {string} refreshTokenHash  SHA-256 hash of the refresh token
 * @param {Request} req              Express request (for User-Agent, IP, headers)
 * @returns {Document}               The created Session document
 * @throws {Error}                   403 if user has reached the 2-session limit on other devices
 */
const createOrUpdateSession = async (userId, refreshTokenHash, req) => {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const deviceId = computeDeviceId(req);
  const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Remove existing session for this device so a new session ID is generated,
  // immediately revoking any previous browser/tab session on this same device.
  await Session.deleteMany({ user: userId, deviceId });

  // Enforce maximum sessions across different devices (at most MAX_SESSIONS = 2)
  const sessionCount = await Session.countDocuments({ user: userId });
  if (sessionCount >= MAX_SESSIONS) {
    const error = new Error(
      `Maximum active sessions reached (${MAX_SESSIONS}). Please log out from another device first.`,
    );
    error.statusCode = 403;
    throw error;
  }

  // Create new session for this device
  const session = await Session.create({
    user: userId,
    refreshTokenHash,
    deviceId,
    userAgent,
    ipAddress,
    lastActiveAt: new Date(),
    expiresAt,
  });

  return session;
};

// ── Routes ──────────────────────────────────────────────────────

// Register
router.post('/register', validate(createUser), async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('A user with this email already exists.');
      error.statusCode = 409;
      return next(error);
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone: phone || null,
    });

    const refreshToken = generateRefreshToken(user._id);
    const session = await createOrUpdateSession(
      user._id,
      hashToken(refreshToken),
      req,
    );
    const accessToken = generateAccessToken(user._id, session._id);

    setCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', validate(loginUser), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      return next(error);
    }

    // Verify password before checking status to prevent account enumeration
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      return next(error);
    }

    if (user.status !== 'active') {
      const error = new Error('Your account has been suspended or deleted.');
      error.statusCode = 403;
      return next(error);
    }

    const refreshToken = generateRefreshToken(user._id);
    const session = await createOrUpdateSession(
      user._id,
      hashToken(refreshToken),
      req,
    );
    const accessToken = generateAccessToken(user._id, session._id);

    user.lastLogin = new Date();
    await user.save();

    setCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Delete the current session
    if (req.sessionId) {
      await Session.deleteOne({ _id: req.sessionId, user: req.user._id });
    } else {
      // Fallback: find session by refresh token hash
      const token = req.cookies?.refreshToken;
      if (token) {
        await Session.deleteOne({
          user: req.user._id,
          refreshTokenHash: hashToken(token),
        });
      }
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// Refresh Access Token
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      const error = new Error('No refresh token provided.');
      error.statusCode = 401;
      return next(error);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      const error = new Error(
        'Invalid or expired refresh token. Please log in again.',
      );
      error.statusCode = 401;
      return next(error);
    }

    // Find the session associated with this refresh token
    const session = await Session.findOne({
      user: decoded.id,
      refreshTokenHash: hashToken(token),
    });

    if (!session) {
      const error = new Error(
        'Session not found or expired. Please log in again.',
      );
      error.statusCode = 401;
      return next(error);
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      await Session.deleteOne({ _id: session._id });
      const error = new Error('User no longer exists.');
      error.statusCode = 401;
      return next(error);
    }

    if (user.status !== 'active') {
      await Session.deleteMany({ user: user._id });
      const error = new Error('Your account has been suspended or deleted.');
      error.statusCode = 403;
      return next(error);
    }

    // Rotate tokens
    const newRefreshToken = generateRefreshToken(user._id);
    const newAccessToken = generateAccessToken(user._id, session._id);

    // Update session with rotated refresh token
    session.refreshTokenHash = hashToken(newRefreshToken);
    session.lastActiveAt = new Date();
    session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await session.save();

    setCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully.',
      accessToken: newAccessToken,
    });
  } catch (err) {
    next(err);
  }
});

// Current User Profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'User profile retrieved.',
      user: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
        phone: req.user.phone,
        isEmailVerified: req.user.isEmailVerified,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Session Management ──────────────────────────────────────────

// List active sessions for the current user
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const sessions = await Session.find({ user: req.user._id })
      .select('userAgent ipAddress lastActiveAt createdAt')
      .sort({ lastActiveAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Active sessions retrieved.',
      sessions: sessions.map((s) => ({
        _id: s._id,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        isCurrent: s._id.toString() === req.sessionId?.toString(),
      })),
      count: sessions.length,
      maxSessions: MAX_SESSIONS,
    });
  } catch (err) {
    next(err);
  }
});

// Revoke a specific session (log out from another device)
router.delete('/sessions/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.isValidObjectId(sessionId)) {
      const error = new Error('Invalid session ID.');
      error.statusCode = 400;
      return next(error);
    }

    // Prevent revoking the current session (use /logout instead)
    if (sessionId === req.sessionId?.toString()) {
      const error = new Error(
        'Cannot revoke your current session. Use the logout endpoint instead.',
      );
      error.statusCode = 400;
      return next(error);
    }

    const session = await Session.findOneAndDelete({
      _id: sessionId,
      user: req.user._id,
    });

    if (!session) {
      const error = new Error('Session not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// ── Password Management ─────────────────────────────────────────

// Change Password (logged-in user)
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user._id).select('+password');

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        const error = new Error('Current password is incorrect.');
        error.statusCode = 400;
        return next(error);
      }

      if (currentPassword === newPassword) {
        const error = new Error(
          'New password cannot be the same as current password.',
        );
        error.statusCode = 400;
        return next(error);
      }

      user.password = newPassword;
      await user.save();

      // Clear ALL sessions across all devices (forces re-login everywhere)
      await Session.deleteMany({ user: user._id });

      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message: 'Password changed successfully. Please log in again.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// Forgot Password
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });

      if (user) {
        // Generate a random reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash it with SHA-256 and store on the user with a 10-minute expiry
        user.passwordResetToken = crypto
          .createHash('sha256')
          .update(resetToken)
          .digest('hex');
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        // Log in development for testing until an email service is integrated
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `\n🔑 [DEV ONLY] Password reset token for ${email}: ${resetToken}\n`,
          );
        }
      }

      // Always return a generic 200 response to prevent account enumeration
      res.status(200).json({
        success: true,
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// Reset Password
router.post(
  '/reset-password/:token',
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const { token } = req.params;
      const { password } = req.body;

      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      }).select('+passwordResetToken +passwordResetExpires');

      if (!user) {
        const error = new Error('Token is invalid or has expired.');
        error.statusCode = 400;
        return next(error);
      }

      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      // Clear ALL sessions across all devices (forces re-login everywhere)
      await Session.deleteMany({ user: user._id });

      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message:
          'Password reset successful. Please log in with your new password.',
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
