import ApiError from '../utils/ApiError.js';

/**
 * Catch-all for routes that don't match any defined endpoint.
 */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export default notFound;
