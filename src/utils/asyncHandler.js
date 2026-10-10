/**
 * Wraps an async route handler so thrown errors are forwarded to
 * Express's `next()` instead of crashing the process.
 *
 * Usage:
 *   router.get('/items', asyncHandler(async (req, res) => { ... }));
 *
 * @param {Function} fn – async (req, res, next) => void
 * @returns {Function}
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
