import jwt from 'jsonwebtoken';
import User from '../models/user.js';

/**
 * authenticate — verifies the access token from the cookie
 * and attaches the user to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      const error = new Error('Not authenticated. Please log in.');
      error.statusCode = 401;
      return next(error);
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      const error = new Error('User no longer exists.');
      error.statusCode = 401;
      return next(error);
    }

    if (user.status !== 'active') {
      const error = new Error('Your account has been suspended or deleted.');
      error.statusCode = 403;
      return next(error);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Access token expired. Please refresh.');
      error.statusCode = 401;
      return next(error);
    }
    if (err.name === 'JsonWebTokenError') {
      const error = new Error('Invalid token.');
      error.statusCode = 401;
      return next(error);
    }
    next(err);
  }
};

/**
 * authorize — restricts access to specific roles.
 * Must be used after authenticate.
 *
 * Usage: authorize('admin') or authorize('admin', 'customer')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    return next(error);
  }

  if (!roles.includes(req.user.role)) {
    const error = new Error('You do not have permission to perform this action.');
    error.statusCode = 403;
    return next(error);
  }

  next();
};

export { authenticate, authorize };
