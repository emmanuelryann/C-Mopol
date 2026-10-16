import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.js';
import { authenticate } from '../middlewares/auth.js';
import {
  validate,
  createUser,
  loginUser,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../middlewares/validation.js';

const router = Router();

// ── Token Helpers ───────────────────────────────────────────────

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '15m',
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
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
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
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

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    user.refreshToken = hashedRefreshToken;
    await user.save();

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

    const user = await User.findOne({ email }).select('+password +refreshToken');
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      return next(error);
    }

    if (user.status !== 'active') {
      const error = new Error('Your account has been suspended or deleted.');
      error.statusCode = 403;
      return next(error);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      return next(error);
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    user.refreshToken = hashedRefreshToken;
    user.lastLogin = new Date();
    await user.save();

    setCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
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

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

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
    } catch (err) {
      const error = new Error('Invalid or expired refresh token. Please log in again.');
      error.statusCode = 401;
      return next(error);
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || !user.refreshToken) {
      const error = new Error('Refresh token not found. Please log in again.');
      error.statusCode = 401;
      return next(error);
    }

    const isTokenValid = await bcrypt.compare(token, user.refreshToken);
    if (!isTokenValid) {
      const error = new Error('Invalid refresh token. Please log in again.');
      error.statusCode = 401;
      return next(error);
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
    user.refreshToken = hashedRefreshToken;
    await user.save();

    setCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully.',
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
      data: {
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
      },
    });
  } catch (err) {
    next(err);
  }
});

// Forgot Password
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error('No account found with that email.');
      error.statusCode = 404;
      return next(error);
    }

    // Generate a random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash it and store on the user with a 10-minute expiry
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // For now, return the token directly. When email is integrated,
    // send it via email instead and remove it from the response.
    res.status(200).json({
      success: true,
      message: 'Password reset token generated.',
      data: {
        resetToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Reset Password
router.post('/reset-password/:token', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash the incoming token to compare with the stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      const error = new Error('Token is invalid or has expired.');
      error.statusCode = 400;
      return next(error);
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = null;
    await user.save();

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
