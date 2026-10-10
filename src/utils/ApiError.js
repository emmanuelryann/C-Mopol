import { StatusCodes, getReasonPhrase } from 'http-status-codes';

/**
 * Custom operational error for the API.
 * Extends the native Error with an HTTP status code and
 * an `isOperational` flag so the error handler can distinguish
 * between expected errors and unexpected crashes.
 */
class ApiError extends Error {
  /**
   * @param {number}  statusCode – HTTP status code (e.g. 400, 404, 500)
   * @param {string}  message    – Human-readable error description
   * @param {boolean} [isOperational=true] – true for expected/handled errors
   * @param {Array}   [errors=[]] – Optional array of validation sub-errors
   */
  constructor(
    statusCode,
    message,
    isOperational = true,
    errors = [],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  // ── Factory helpers ─────────────────────────────────────────────

  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(StatusCodes.BAD_REQUEST, message, true, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(StatusCodes.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(StatusCodes.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(StatusCodes.NOT_FOUND, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(StatusCodes.CONFLICT, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, message, false);
  }
}

export default ApiError;
