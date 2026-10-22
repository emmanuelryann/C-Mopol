import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/user.js';
import Product from '../models/product.js';
import Category from '../models/category.js';
import Order from '../models/order.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  validate,
  adminUpdateUser,
  adminUpdatePaymentStatus,
} from '../middlewares/validation.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'));

// ─────────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalProducts,
      activeProducts,
      totalCategories,
      totalOrders,
      ordersByStatus,
      revenueResult,
      lowStockProducts,
      outOfStockProducts,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Category.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { status: { $nin: ['cancelled', 'failed'] } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            averageOrderValue: { $avg: '$totalAmount' },
          },
        },
      ]),
      Product.countDocuments({ isActive: true, stock: { $gt: 0, $lte: 10 } }),
      Product.countDocuments({ isActive: true, stock: 0 }),
      Order.find()
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // Convert ordersByStatus array to an object
    const statusBreakdown = {};
    for (const entry of ordersByStatus) {
      statusBreakdown[entry._id] = entry.count;
    }

    const revenue = revenueResult[0] || { totalRevenue: 0, averageOrderValue: 0 };

    res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved.',
      data: {
        users: {
          total: totalUsers,
        },
        products: {
          total: totalProducts,
          active: activeProducts,
          archived: totalProducts - activeProducts,
        },
        categories: {
          total: totalCategories,
        },
        orders: {
          total: totalOrders,
          statusBreakdown,
        },
        revenue: {
          total: Math.round(revenue.totalRevenue * 100) / 100,
          averageOrderValue: Math.round(revenue.averageOrderValue * 100) / 100,
        },
        inventory: {
          lowStock: lowStockProducts,
          outOfStock: outOfStockProducts,
        },
        recentOrders,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
//  USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────

// List all users with filtering and pagination
router.get('/users', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      search,
      sort = '-createdAt',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (typeof role === 'string' && ['customer', 'admin'].includes(role)) {
      filter.role = role;
    }

    if (typeof status === 'string' && ['active', 'suspended', 'deleted'].includes(status)) {
      filter.status = status;
    }

    if (typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    const allowedSort = ['createdAt', 'firstName', 'lastName', 'email', 'role', 'status'];
    const sortOptions = {};
    String(sort)
      .split(',')
      .forEach((field) => {
        const trimmed = field.trim();
        const key = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
        if (allowedSort.includes(key)) {
          sortOptions[key] = trimmed.startsWith('-') ? -1 : 1;
        }
      });
    if (Object.keys(sortOptions).length === 0) {
      sortOptions.createdAt = -1;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-__v')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      message: 'Users retrieved.',
      data: {
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get a single user by ID
router.get('/users/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      const error = new Error('Invalid user ID.');
      error.statusCode = 400;
      return next(error);
    }

    const user = await User.findById(req.params.id).select('-__v');

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      return next(error);
    }

    // Fetch user's order summary
    const orderSummary = await Order.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
        },
      },
    ]);

    const stats = orderSummary[0] || { totalOrders: 0, totalSpent: 0 };

    res.status(200).json({
      success: true,
      message: 'User retrieved.',
      data: {
        user,
        orderStats: {
          totalOrders: stats.totalOrders,
          totalSpent: Math.round(stats.totalSpent * 100) / 100,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update a user's role or status
router.patch('/users/:id', validate(adminUpdateUser), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      const error = new Error('Invalid user ID.');
      error.statusCode = 400;
      return next(error);
    }

    // Prevent admin from modifying their own role/status
    if (req.params.id === req.user._id.toString()) {
      const error = new Error('You cannot modify your own role or status.');
      error.statusCode = 400;
      return next(error);
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      return next(error);
    }

    // Apply changes
    if (req.body.role !== undefined) {
      user.role = req.body.role;
    }

    if (req.body.status !== undefined) {
      user.status = req.body.status;

      // Invalidate sessions when suspending or deleting
      if (req.body.status !== 'active') {
        user.refreshToken = null;
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated.',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
//  INVENTORY MONITORING
// ─────────────────────────────────────────────────────────────────

// Get inventory overview with low/out-of-stock products
router.get('/inventory', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      stockFilter,
      sort = 'stock',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { isActive: true };

    // Filter by stock level
    if (stockFilter === 'out') {
      filter.stock = 0;
    } else if (stockFilter === 'low') {
      filter.stock = { $gt: 0, $lte: 10 };
    } else if (stockFilter === 'healthy') {
      filter.stock = { $gt: 10 };
    }

    const allowedSort = ['stock', 'name', 'price', 'createdAt'];
    const sortOptions = {};
    String(sort)
      .split(',')
      .forEach((field) => {
        const trimmed = field.trim();
        const key = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
        if (allowedSort.includes(key)) {
          sortOptions[key] = trimmed.startsWith('-') ? -1 : 1;
        }
      });
    if (Object.keys(sortOptions).length === 0) {
      sortOptions.stock = 1;
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .select('name slug sku stock price isActive')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    // Aggregate stock level summary
    const [summary] = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          outOfStock: {
            $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] },
          },
          lowStock: {
            $sum: {
              $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 10] }] }, 1, 0],
            },
          },
          totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
        },
      },
    ]);

    const stats = summary || {
      totalProducts: 0,
      totalStock: 0,
      outOfStock: 0,
      lowStock: 0,
      totalValue: 0,
    };

    res.status(200).json({
      success: true,
      message: 'Inventory retrieved.',
      data: {
        summary: {
          totalProducts: stats.totalProducts,
          totalStock: stats.totalStock,
          outOfStock: stats.outOfStock,
          lowStock: stats.lowStock,
          inventoryValue: Math.round(stats.totalValue * 100) / 100,
        },
        products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
//  PAYMENT STATUS & RECORDS
// ─────────────────────────────────────────────────────────────────

// List payment records across orders
router.get('/payments', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      paymentStatus,
      paymentMethod,
      sort = '-createdAt',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (typeof paymentStatus === 'string' && ['pending', 'completed', 'failed', 'refunded'].includes(paymentStatus)) {
      filter.paymentStatus = paymentStatus;
    }

    if (typeof paymentMethod === 'string' && paymentMethod.trim()) {
      filter.paymentMethod = paymentMethod.trim();
    }

    const allowedSort = ['createdAt', 'totalAmount', 'paidAt', 'paymentStatus'];
    const sortOptions = {};
    String(sort)
      .split(',')
      .forEach((field) => {
        const trimmed = field.trim();
        const key = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
        if (allowedSort.includes(key)) {
          sortOptions[key] = trimmed.startsWith('-') ? -1 : 1;
        }
      });
    if (Object.keys(sortOptions).length === 0) {
      sortOptions.createdAt = -1;
    }

    const [payments, total, summary] = await Promise.all([
      Order.find(filter)
        .select('orderNumber user totalAmount paymentStatus paymentMethod paidAt createdAt')
        .populate('user', 'firstName lastName email')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
            completedAmount: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$totalAmount', 0],
              },
            },
          },
        },
      ]),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    const stats = summary[0] || { totalAmount: 0, completedAmount: 0 };

    res.status(200).json({
      success: true,
      message: 'Payment records retrieved.',
      data: {
        summary: {
          totalAmount: Math.round(stats.totalAmount * 100) / 100,
          completedAmount: Math.round(stats.completedAmount * 100) / 100,
        },
        payments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update payment status on an order
router.patch('/orders/:id/payment', validate(adminUpdatePaymentStatus), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      const error = new Error('Invalid order ID.');
      error.statusCode = 400;
      return next(error);
    }

    const { paymentStatus } = req.body;

    const updateFields = { paymentStatus };
    if (paymentStatus === 'completed') {
      updateFields.paidAt = new Date();
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true },
    ).populate('user', 'firstName lastName email');

    if (!order) {
      const error = new Error('Order not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: `Payment status updated to "${paymentStatus}".`,
      data: { order },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
