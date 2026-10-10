import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import config from './config/index.js';
import ApiResponse from './utils/ApiResponse.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

// ── Security ────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  }),
);

// ── Rate limiting ───────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ── Body parsing ────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// ── Logging ─────────────────────────────────────────────────────
if (config.env === 'development') {
  app.use(morgan('dev'));
}

// ── Health-check route ──────────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  new ApiResponse(200, 'Server is running 🚀').send(res);
});

// ──────────────────────────────────────────────────────────────────
// Future route imports will go here:
// import productRoutes from './routes/product.routes.js';
// app.use('/api/v1/products', productRoutes);
// ──────────────────────────────────────────────────────────────────

// ── Error handling (must be last) ───────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
