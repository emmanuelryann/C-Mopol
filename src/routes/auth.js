import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/user.js';
import Session from '../models/session.js';
import PendingRegistration, {
  encryptPassword,
  decryptPassword,
} from '../models/pendingRegistration.js';
import { authenticate } from '../middlewares/auth.js';
import emailService from '../services/emailService.js';
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

const generateVerificationCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
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
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if user already exists in the permanent database
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const error = new Error(
        'Unable to complete registration. If you already have an account, please log in.',
      );
      error.statusCode = 409;
      return next(error);
    }

    // 2. Remove any previous pending registration for this email
    await PendingRegistration.deleteMany({ email: normalizedEmail });

    // 3. Generate verification code & token
    const verificationCode = generateVerificationCode();
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // 4. Temporarily hold registration in PendingRegistration (with encrypted password and 15m TTL)
    // NO account is created in the User collection until verification is complete!
    await PendingRegistration.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      encryptedPassword: encryptPassword(password),
      phone: phone ? phone.trim() : null,
      verificationCodeHash: hashToken(verificationCode),
      verificationTokenHash: hashToken(verificationToken),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes TTL auto-purge
    });

    // 5. Dispatch verification email via Resend
    emailService
      .sendVerificationEmail({
        to: normalizedEmail,
        firstName: firstName.trim(),
        code: verificationCode,
        token: verificationToken,
      })
      .catch((err) => console.error('Verification email dispatch error:', err.message));

    if (process.env.NODE_ENV === 'development') {
      console.log(`\n📨 [DEV ONLY] Verification code for ${normalizedEmail}: ${verificationCode}\n`);
    }

    // 6. Return response to frontend. No session or permanent user created yet!
    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Please verify your email to complete registration.',
      data: {
        email: normalizedEmail,
        pending: true,
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
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      // Check if user has an unverified pending registration
      const pending = await PendingRegistration.findOne({ email: normalizedEmail });
      if (pending) {
        const error = new Error(
          'Please complete your email verification before logging in. A verification code was sent to your email.',
        );
        error.statusCode = 403;
        return next(error);
      }

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

// ── Email Verification ──────────────────────────────────────────

// Verify Email (Code or Token)
router.post('/verify-email', async (req, res, next) => {
  try {
    const { code, email, token } = req.body;

    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    const hashedCode = code ? hashToken(code.trim().toUpperCase()) : null;
    const hashedToken = token ? hashToken(token.trim()) : null;

    if (!hashedToken && (!hashedCode || !normalizedEmail)) {
      const error = new Error('Please enter your verification code and email address.');
      error.statusCode = 400;
      return next(error);
    }

    // ── STEP 1: Check Pending Registration First ──
    let pending;
    if (hashedToken) {
      pending = await PendingRegistration.findOne({
        verificationTokenHash: hashedToken,
        expiresAt: { $gt: new Date() },
      });
    } else if (hashedCode && normalizedEmail) {
      pending = await PendingRegistration.findOne({
        email: normalizedEmail,
        verificationCodeHash: hashedCode,
        expiresAt: { $gt: new Date() },
      });
    }

    if (pending) {
      // Check if user already exists in permanent collection
      const existingUser = await User.findOne({ email: pending.email });
      if (existingUser) {
        await PendingRegistration.deleteMany({ email: pending.email });
        const error = new Error('An account with this email already exists. Please log in.');
        error.statusCode = 409;
        return next(error);
      }

      // Decrypt password
      const rawPassword = decryptPassword(pending.encryptedPassword);

      // CREATE THE USER IN DATABASE ONLY NOW UPON SUCCESSFUL EMAIL VERIFICATION
      const newUser = await User.create({
        firstName: pending.firstName,
        lastName: pending.lastName,
        email: pending.email,
        password: rawPassword, // Will be hashed with bcrypt by userSchema.pre('save')
        phone: pending.phone || null,
        isEmailVerified: true,
      });

      // Remove the pending registration document
      await PendingRegistration.deleteMany({ email: pending.email });

      // Create session and set auth cookies
      const refreshToken = generateRefreshToken(newUser._id);
      const session = await createOrUpdateSession(
        newUser._id,
        hashToken(refreshToken),
        req,
      );
      const accessToken = generateAccessToken(newUser._id, session._id);

      setCookies(res, accessToken, refreshToken);

      // Asynchronously dispatch welcome email
      emailService
        .sendWelcomeEmail({
          to: newUser.email,
          firstName: newUser.firstName,
        })
        .catch((err) => console.error('Welcome email dispatch error:', err.message));

      return res.status(200).json({
        success: true,
        message: 'Email address verified and account created successfully!',
        user: {
          _id: newUser._id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: newUser.role,
          phone: newUser.phone,
          isEmailVerified: true,
        },
        accessToken,
      });
    }

    // ── STEP 2: Check Existing User (for profile verification flow) ──
    let user;
    if (hashedToken) {
      user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() },
      }).select('+emailVerificationCode +emailVerificationToken +emailVerificationExpires');
    } else if (hashedCode && normalizedEmail) {
      user = await User.findOne({
        email: normalizedEmail,
        emailVerificationCode: hashedCode,
        emailVerificationExpires: { $gt: Date.now() },
      }).select('+emailVerificationCode +emailVerificationToken +emailVerificationExpires');
    }

    if (!user) {
      const error = new Error('Verification code is invalid or has expired.');
      error.statusCode = 400;
      return next(error);
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email address verified successfully.',
      data: {
        isEmailVerified: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Link-based verification
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const hashedToken = hashToken(token);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // ── STEP 1: Check Pending Registration First ──
    const pending = await PendingRegistration.findOne({
      verificationTokenHash: hashedToken,
      expiresAt: { $gt: new Date() },
    });

    if (pending) {
      const rawPassword = decryptPassword(pending.encryptedPassword);

      // CREATE THE USER IN DATABASE ONLY NOW UPON SUCCESSFUL EMAIL VERIFICATION
      const newUser = await User.create({
        firstName: pending.firstName,
        lastName: pending.lastName,
        email: pending.email,
        password: rawPassword,
        phone: pending.phone || null,
        isEmailVerified: true,
      });

      await PendingRegistration.deleteMany({ email: pending.email });

      const refreshToken = generateRefreshToken(newUser._id);
      const session = await createOrUpdateSession(
        newUser._id,
        hashToken(refreshToken),
        req,
      );
      const accessToken = generateAccessToken(newUser._id, session._id);

      setCookies(res, accessToken, refreshToken);

      emailService
        .sendWelcomeEmail({
          to: newUser.email,
          firstName: newUser.firstName,
        })
        .catch((err) => console.error('Welcome email dispatch error:', err.message));

      if (req.headers.accept?.includes('text/html')) {
        return res.redirect(`${frontendUrl}/dashboard?verified=true`);
      }

      return res.status(200).json({
        success: true,
        message: 'Email address verified and account created successfully.',
        user: {
          _id: newUser._id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: newUser.role,
          phone: newUser.phone,
          isEmailVerified: true,
        },
        accessToken,
      });
    }

    // ── STEP 2: Check Existing User ──
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationCode +emailVerificationToken +emailVerificationExpires');

    if (!user) {
      if (req.headers.accept?.includes('text/html')) {
        return res.redirect(`${frontendUrl}/login?error=invalid_or_expired_verification_token`);
      }
      const error = new Error('Verification link is invalid or has expired.');
      error.statusCode = 400;
      return next(error);
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    if (req.headers.accept?.includes('text/html')) {
      return res.redirect(`${frontendUrl}/dashboard?verified=true`);
    }

    res.status(200).json({
      success: true,
      message: 'Email address verified successfully.',
      data: { isEmailVerified: true },
    });
  } catch (err) {
    next(err);
  }
});

// Resend verification code
router.post('/resend-verification', async (req, res, next) => {
  try {
    const email = req.body?.email || req.user?.email;

    if (!email) {
      const error = new Error('Email address is required.');
      error.statusCode = 400;
      return next(error);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ── STEP 1: Check Pending Registration ──
    const pending = await PendingRegistration.findOne({ email: normalizedEmail });
    if (pending) {
      const verificationCode = generateVerificationCode();
      const verificationToken = crypto.randomBytes(32).toString('hex');

      pending.verificationCodeHash = hashToken(verificationCode);
      pending.verificationTokenHash = hashToken(verificationToken);
      pending.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await pending.save();

      await emailService.sendVerificationEmail({
        to: pending.email,
        firstName: pending.firstName,
        code: verificationCode,
        token: verificationToken,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`\n📨 [DEV ONLY] Resent verification code for ${pending.email}: ${verificationCode}\n`);
      }

      return res.status(200).json({
        success: true,
        message: 'Verification code resent successfully. Please check your inbox.',
      });
    }

    // ── STEP 2: Check Existing User ──
    const user = await User.findOne({ email: normalizedEmail });

    // Return generic message to prevent account discovery
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account or pending registration with that email exists, a new verification code has been sent.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Your email address is already verified.',
      });
    }

    const verificationCode = generateVerificationCode();
    const verificationToken = crypto.randomBytes(32).toString('hex');

    user.emailVerificationCode = hashToken(verificationCode);
    user.emailVerificationToken = hashToken(verificationToken);
    user.emailVerificationExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    await emailService.sendVerificationEmail({
      to: user.email,
      firstName: user.firstName,
      code: verificationCode,
      token: verificationToken,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`\n📨 [DEV ONLY] Resent verification code for ${user.email}: ${verificationCode}\n`);
    }

    res.status(200).json({
      success: true,
      message: 'Verification code resent successfully. Please check your inbox.',
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

      // Dispatch security notification email asynchronously
      emailService
        .sendPasswordChangedEmail({
          to: user.email,
          firstName: user.firstName,
        })
        .catch((err) => console.error('Password changed notification error:', err.message));

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
      const normalizedEmail = email ? email.trim().toLowerCase() : '';

      const user = await User.findOne({ email: normalizedEmail });

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

        // Dispatch password reset email via Resend
        await emailService.sendPasswordResetEmail({
          to: user.email,
          firstName: user.firstName,
          resetToken,
        });

        // Log in development for testing
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `\n🔑 [DEV ONLY] Password reset token for ${normalizedEmail}: ${resetToken}\n`,
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

      // Dispatch security notification email asynchronously
      emailService
        .sendPasswordChangedEmail({
          to: user.email,
          firstName: user.firstName,
        })
        .catch((err) => console.error('Password changed notification error:', err.message));

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
