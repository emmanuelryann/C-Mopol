import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import connectDB from './config/db.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/category.js';
import productRoutes from './routes/product.js';
import cartRoutes from './routes/cart.js';
import addressRoutes from './routes/address.js';
import orderRoutes from './routes/order.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes from './routes/payment.js';
import paymentService from './services/paymentService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Trust reverse proxy (enables proper client IP resolution for rate limiters behind Nginx/Render/Heroku)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  }),
);

// Body parsing
app.use(
  express.json({
    limit: '16kb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(cookieParser());

// Logging (development only)
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running 🚀',
  });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/payments', paymentRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const startServer = async () => {
  // Validate payment gateway configuration early (fails fast if mock in production)
  const isMock = paymentService.isMockMode();
  if (isMock) {
    console.warn('⚠️  Payment service running in MOCK mode.');
  }

  await connectDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
    console.log(`   Health check → http://localhost:${PORT}/api/v1/health\n`);
  });
};

startServer();
