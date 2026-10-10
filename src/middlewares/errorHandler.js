import ApiError from '../utils/ApiError.js';
import config from '../config/index.js';

/**
 * Global error-handling middleware.
 *
 * ── Response shape (consistent with ApiResponse) ──
 * {
 *   success: false,
 *   message: "...",
 *   errors:  [ ... ],         // optional validation details
 *   stack:   "..."            // only in development
 * }
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // ── Normalise to an ApiError ───────────────────────────────────

  // Mongoose bad ObjectId / CastError
  if (err.name === 'CastError') {
    err = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // Mongoose duplicate key (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue).join(', ');
    err = ApiError.conflict(`Duplicate value for field(s): ${field}`);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    err = ApiError.badRequest('Validation failed', messages);
  }

  // JSON parse errors
  if (err.type === 'entity.parse.failed') {
    err = ApiError.badRequest('Invalid JSON in request body');
  }

  // ── Build response ────────────────────────────────────────────

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  const body = {
    success: false,
    message,
    ...(err.errors?.length && { errors: err.errors }),
    ...(config.env === 'development' && { stack: err.stack }),
  };

  console.error(`❌ [${statusCode}] ${message}`);
  if (config.env === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json(body);
};

export default errorHandler;
