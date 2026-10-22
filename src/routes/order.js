import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/order.js';
import Cart from '../models/cart.js';
import Product from '../models/product.js';
import Address from '../models/address.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  validate,
  checkout,
  updateOrderStatus,
  cancelOrder,
} from '../middlewares/validation.js';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Generate a unique, human-readable order number.
 * Format: CMPL-YYYYMMDD-XXXXXX (hex suffix for uniqueness)
 */
const generateOrderNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CMPL-${date}-${suffix}`;
};

/**
 * Valid order status transitions.
 * Each key lists the statuses it can move to.
 */
const STATUS_TRANSITIONS = {
  pending: ['processing', 'cancelled', 'failed'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  failed: [],
};

// ── Admin Routes (placed before /:id to avoid route collision) ──

// Admin: List all orders with filtering and pagination
router.get('/admin', authorize('admin'), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      sort = '-createdAt',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (typeof status === 'string' && status) {
      filter.status = status;
    }

    if (typeof paymentStatus === 'string' && paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    // Safe sorting with whitelist
    const allowedSort = ['createdAt', 'totalAmount', 'status'];
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

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'firstName lastName email')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      message: 'Orders retrieved.',
      data: {
        orders,
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

// Admin: Get any order by ID
router.get('/admin/:id', authorize('admin'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'firstName lastName email');

    if (!order) {
      const error = new Error('Order not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Order retrieved.',
      data: { order },
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Update order status
router.patch('/admin/:id/status', authorize('admin'), validate(updateOrderStatus), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      const error = new Error('Order not found.');
      error.statusCode = 404;
      return next(error);
    }

    const { status, cancellationReason } = req.body;

    // Validate status transition
    const allowed = STATUS_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(status)) {
      const error = new Error(
        `Cannot transition from "${order.status}" to "${status}".`,
      );
      error.statusCode = 400;
      return next(error);
    }

    const updateFields = { status };
    if (status === 'cancelled') {
      updateFields.cancelledAt = new Date();
      updateFields.cancellationReason = cancellationReason || 'Cancelled by admin.';
    }

    // Atomically update only if status has not changed concurrently
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: req.params.id, status: order.status },
      updateFields,
      { new: true },
    );

    if (!updatedOrder) {
      const error = new Error(
        'Order status was modified by another request. Please refresh and try again.',
      );
      error.statusCode = 409;
      return next(error);
    }

    // Restore stock only if transitioning to cancelled or failed
    if (status === 'cancelled' || status === 'failed') {
      const stockOps = updatedOrder.items.map((item) =>
        Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity } },
        ),
      );
      await Promise.all(stockOps);
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to "${status}".`,
      data: { order: updatedOrder },
    });
  } catch (err) {
    next(err);
  }
});

// ── Customer Routes ─────────────────────────────────────────────

// POST /checkout — Create an order from the cart
router.post('/checkout', validate(checkout), async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { addressId, shippingAddress: inlineAddress, paymentMethod, notes } = req.body;

    // ── 1. Resolve the shipping address ──────────────────────
    let shippingAddress;

    if (addressId) {
      const saved = await Address.findOne({
        _id: addressId,
        user: req.user._id,
      }).session(session);

      if (!saved) {
        const error = new Error('Saved address not found.');
        error.statusCode = 404;
        throw error;
      }

      // Snapshot the address fields (don't reference the document)
      shippingAddress = {
        fullName: saved.fullName,
        phone: saved.phone,
        addressLine1: saved.addressLine1,
        addressLine2: saved.addressLine2 || '',
        city: saved.city,
        state: saved.state,
        postalCode: saved.postalCode,
        country: saved.country,
      };
    } else {
      shippingAddress = inlineAddress;
    }

    // ── 2. Retrieve and validate the cart ────────────────────
    const cart = await Cart.findOne({ user: req.user._id }).session(session);

    if (!cart || cart.items.length === 0) {
      const error = new Error('Your cart is empty.');
      error.statusCode = 400;
      throw error;
    }

    // ── 3. Fetch current product data and validate ───────────
    const productIds = cart.items.map((item) => item.product);
    const products = await Product.find({ _id: { $in: productIds } })
      .populate('category', 'isActive')
      .session(session);

    // Build a lookup map
    const productMap = new Map();
    for (const p of products) {
      productMap.set(p._id.toString(), p);
    }

    const orderItems = [];
    const stockErrors = [];

    for (const cartItem of cart.items) {
      const product = productMap.get(cartItem.product.toString());

      if (!product) {
        stockErrors.push(`Product "${cartItem.product}" no longer exists.`);
        continue;
      }

      if (!product.isActive) {
        stockErrors.push(`"${product.name}" is no longer available.`);
        continue;
      }

      if (!product.category || !product.category.isActive) {
        stockErrors.push(`"${product.name}" is no longer available.`);
        continue;
      }

      if (product.stock < cartItem.quantity) {
        stockErrors.push(
          `"${product.name}" has only ${product.stock} unit(s) in stock (requested ${cartItem.quantity}).`,
        );
        continue;
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        image: product.images?.[0] || '',
      });
    }

    if (stockErrors.length > 0) {
      const error = new Error('Some items in your cart cannot be fulfilled.');
      error.statusCode = 400;
      error.errors = stockErrors;
      throw error;
    }

    // ── 4. Server-side price calculation ─────────────────────
    const itemsTotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const shippingFee = 0; // Placeholder — integrate shipping calculator later
    const tax = 0;         // Placeholder — integrate tax engine later
    const totalAmount = itemsTotal + shippingFee + tax;

    // ── 5. Atomic stock decrement ────────────────────────────
    for (const item of orderItems) {
      const result = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
      ).session(session);

      if (result.matchedCount === 0) {
        const error = new Error(
          `Insufficient stock for "${item.name}". Please try again.`,
        );
        error.statusCode = 409;
        throw error;
      }
    }

    // ── 6. Create the order ──────────────────────────────────
    const orderNumber = generateOrderNumber();

    const [order] = await Order.create(
      [
        {
          user: req.user._id,
          orderNumber,
          items: orderItems,
          shippingAddress,
          itemsTotal,
          shippingFee,
          tax,
          totalAmount,
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod,
          notes: notes || undefined,
        },
      ],
      { session },
    );

    // ── 7. Clear the cart ────────────────────────────────────
    cart.items = [];
    await cart.save({ session });

    // ── 8. Commit ────────────────────────────────────────────
    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      data: { order },
    });
  } catch (err) {
    await session.abortTransaction();

    // Helpful message if running against a standalone local MongoDB without replica set
    if (err.message && err.message.includes('Transaction numbers are only allowed on a replica set member')) {
      const replicaErr = new Error(
        'Database transaction failed: MongoDB replica set is required for checkout transactions. Use MongoDB Atlas or enable a single-node replica set locally.',
      );
      replicaErr.statusCode = 500;
      return next(replicaErr);
    }

    // Pass structured errors through
    if (err.statusCode) {
      return next(err);
    }
    next(err);
  } finally {
    session.endSession();
  }
});

// GET / — List the logged-in customer's orders
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sort = '-createdAt',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = { user: req.user._id };

    if (typeof status === 'string' && status) {
      filter.status = status;
    }

    const allowedSort = ['createdAt', 'totalAmount'];
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

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      message: 'Orders retrieved.',
      data: {
        orders,
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

// GET /:id — Get a single order (customer can only see their own)
router.get('/:id', async (req, res, next) => {
  try {
    const filter = { _id: req.params.id };

    // Non-admin users can only view their own orders
    if (req.user.role !== 'admin') {
      filter.user = req.user._id;
    }

    const order = await Order.findOne(filter);

    if (!order) {
      const error = new Error('Order not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Order retrieved.',
      data: { order },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/cancel — Customer cancels their own pending order
router.patch('/:id/cancel', validate(cancelOrder), async (req, res, next) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, status: 'pending' },
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: req.body.reason || 'Cancelled by customer.',
      },
      { new: true },
    );

    if (!order) {
      const exists = await Order.exists({ _id: req.params.id, user: req.user._id });
      const error = new Error(
        exists ? 'Only pending orders can be cancelled.' : 'Order not found.',
      );
      error.statusCode = exists ? 400 : 404;
      return next(error);
    }

    // Only the request that actually changed the status gets here
    await Promise.all(
      order.items.map((item) =>
        Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity } },
        ),
      ),
    );

    res.status(200).json({
      success: true,
      message: 'Order cancelled.',
      data: { order },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
