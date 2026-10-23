import { Router } from 'express';
import mongoose from 'mongoose';
import Payment, { PAYMENT_STATUSES } from '../models/payment.js';
import Order from '../models/order.js';
import paymentService from '../services/paymentService.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate, initializePayment } from '../middlewares/validation.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────
//  WEBHOOK ENDPOINT (Must be public, raw body used for HMAC check)
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/payments/webhook
 * Public endpoint called by payment provider (Paystack / webhook simulator).
 * Validates HMAC-SHA512 signature and processes events idempotently.
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const signature =
      req.headers['x-paystack-signature'] ||
      req.headers['x-webhook-signature'];

    // Verify cryptographic signature against unparsed raw request body
    const isValid = paymentService.verifyWebhookSignature(signature, req.rawBody);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature.',
      });
    }

    const { event, data } = req.body || {};

    if (!event || !data || !data.reference) {
      return res.status(200).json({
        success: true,
        message: 'Ignored: Missing event or reference data.',
      });
    }

    const reference = String(data.reference).trim();
    const payment = await Payment.findOne({ reference });

    if (!payment) {
      // Return 200 so provider does not endlessly retry unknown references
      return res.status(200).json({
        success: true,
        message: `Ignored: Payment with reference "${reference}" not found.`,
      });
    }

    const eventId = String(data.id || data.reference);

    // ── Idempotency Check: Already processed this exact event? ──
    const alreadyLogged = payment.processedWebhooks?.some(
      (w) => w.eventId === eventId && w.event === event,
    );
    if (alreadyLogged) {
      return res.status(200).json({
        success: true,
        message: 'Event already processed (idempotent).',
      });
    }

    // ── Handle 'charge.success' ──────────────────────────────
    if (event === 'charge.success') {
      // Verify amount matches if supplied in webhook data (in smallest currency unit)
      if (typeof data.amount === 'number') {
        const expectedSmallestUnit = Math.round(payment.amount * 100);
        if (data.amount !== expectedSmallestUnit) {
          console.warn(
            `[Webhook Warning] Amount mismatch for ref ${reference}: expected ${expectedSmallestUnit}, got ${data.amount}`,
          );
        }
      }

      const paidAtDate = data.paid_at ? new Date(data.paid_at) : new Date();

      // Atomic transition from pending -> completed
      const updatedPayment = await Payment.findOneAndUpdate(
        { _id: payment._id, status: 'pending' },
        {
          status: 'completed',
          transactionId: String(data.id || data.reference),
          paidAt: paidAtDate,
          verifiedAt: new Date(),
          channel: data.channel || payment.channel,
          gatewayResponse: data,
          $push: {
            processedWebhooks: {
              eventId,
              event,
              processedAt: new Date(),
            },
          },
        },
        { new: true },
      );

      if (updatedPayment) {
        // Update Order atomically
        const order = await Order.findById(payment.order);
        if (order && order.paymentStatus !== 'completed') {
          order.paymentStatus = 'completed';
          order.paidAt = paidAtDate;
          if (data.channel) {
            order.paymentMethod = data.channel;
          }
          if (order.status === 'pending') {
            order.status = 'processing';
          }
          await order.save();
        }
      } else {
        // Payment was already marked completed (e.g. by synchronous verify call); record the webhook event
        await Payment.updateOne(
          { _id: payment._id },
          {
            $push: {
              processedWebhooks: {
                eventId,
                event,
                processedAt: new Date(),
              },
            },
          },
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Charge success handled successfully.',
      });
    }

    // ── Handle 'charge.failed' ──────────────────────────────
    if (event === 'charge.failed') {
      await Payment.findOneAndUpdate(
        { _id: payment._id, status: 'pending' },
        {
          status: 'failed',
          failureReason: data.gateway_response || 'Payment failed via webhook.',
          gatewayResponse: data,
          $push: {
            processedWebhooks: {
              eventId,
              event,
              processedAt: new Date(),
            },
          },
        },
      );

      await Order.findOneAndUpdate(
        { _id: payment.order, paymentStatus: 'pending' },
        { paymentStatus: 'failed' },
      );

      return res.status(200).json({
        success: true,
        message: 'Charge failure handled.',
      });
    }

    // Acknowledge other event types (e.g., refund, transfer, etc.)
    return res.status(200).json({
      success: true,
      message: `Event "${event}" acknowledged.`,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
//  AUTHENTICATED PAYMENT ROUTES
// ─────────────────────────────────────────────────────────────────
router.use(authenticate);

/**
 * POST /api/v1/payments/initialize
 * Initialize payment session for an existing order.
 * Strictly calculates amount on the server from the order.
 * Protects against double payments.
 */
router.post('/initialize', validate(initializePayment), async (req, res, next) => {
  try {
    const orderId = req.body.orderId.toLowerCase();
    const { callbackUrl, forceNew = false } = req.body;

    const order = await Order.findById(orderId).populate('user', 'email firstName lastName');
    if (!order) {
      const error = new Error('Order not found.');
      error.statusCode = 404;
      return next(error);
    }

    // Customers can only pay for their own orders
    if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString()) {
      const error = new Error('Not authorized to access this order.');
      error.statusCode = 403;
      return next(error);
    }

    // Check order status
    if (['cancelled', 'failed'].includes(order.status)) {
      const error = new Error(`Cannot pay for a ${order.status} order.`);
      error.statusCode = 400;
      return next(error);
    }

    // Check payment status on order
    if (order.paymentStatus === 'completed') {
      const error = new Error('This order has already been paid for.');
      error.statusCode = 400;
      return next(error);
    }

    // Check if an existing completed payment record exists in the DB
    const existingCompleted = await Payment.findOne({
      order: order._id,
      status: 'completed',
    });
    if (existingCompleted) {
      // Sync order paymentStatus if out of sync
      if (order.paymentStatus !== 'completed') {
        order.paymentStatus = 'completed';
        order.paidAt = existingCompleted.paidAt;
        await order.save();
      }
      const error = new Error('This order has already been paid for.');
      error.statusCode = 400;
      return next(error);
    }

    // Check for an existing pending payment record
    const existingPending = await Payment.findOne({
      order: order._id,
      status: 'pending',
    }).sort({ createdAt: -1 });

    // If an existing pending payment was created within the last 30 minutes and forceNew is false,
    // return the existing authorization URL to prevent accidental double charges
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (existingPending && !forceNew && existingPending.createdAt > thirtyMinutesAgo) {
      return res.status(200).json({
        success: true,
        message: 'Active payment session already exists for this order.',
        data: {
          payment: {
            id: existingPending._id,
            reference: existingPending.reference,
            amount: existingPending.amount,
            currency: existingPending.currency,
            status: existingPending.status,
            authorizationUrl: existingPending.authorizationUrl,
            accessCode: existingPending.accessCode,
            createdAt: existingPending.createdAt,
          },
        },
      });
    }

    // If customer explicitly requests a fresh session or previous one expired,
    // mark previous pending payment as abandoned
    if (existingPending) {
      existingPending.status = 'abandoned';
      existingPending.failureReason = 'Superseded by new payment initialization.';
      await existingPending.save();
    }

    // Email from order user or logged-in user
    const customerEmail = order.user?.email || req.user.email;

    // Initialize with payment service (Paystack provider abstraction)
    const initResult = await paymentService.initializePayment({
      orderId: order._id,
      orderNumber: order.orderNumber,
      email: customerEmail,
      amount: order.totalAmount, // Server-calculated amount — NEVER trust client input
      currency: 'GHS',
      callbackUrl,
      metadata: {
        userId: req.user._id.toString(),
      },
    });

    // Create payment record in database
    const payment = await Payment.create({
      order: order._id,
      user: order.user._id || req.user._id,
      reference: initResult.reference,
      amount: order.totalAmount,
      currency: 'GHS',
      status: 'pending',
      channel: order.paymentMethod || 'card',
      authorizationUrl: initResult.authorizationUrl,
      accessCode: initResult.accessCode,
      gatewayResponse: initResult,
    });

    res.status(201).json({
      success: true,
      message: 'Payment initialized successfully.',
      data: {
        payment: {
          id: payment._id,
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          authorizationUrl: payment.authorizationUrl,
          accessCode: payment.accessCode,
          isMock: initResult.isMock,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/payments/verify/:reference
 * Server-side payment verification with payment gateway.
 * Updates payment and order status only after verified confirmation.
 * Never marks an order as paid based solely on frontend assertions.
 */
router.get('/verify/:reference', async (req, res, next) => {
  try {
    const reference = String(req.params.reference || '').trim();
    if (!reference) {
      const error = new Error('Payment reference is required.');
      error.statusCode = 400;
      return next(error);
    }

    const payment = await Payment.findOne({ reference });
    if (!payment) {
      const error = new Error('Payment reference not found.');
      error.statusCode = 404;
      return next(error);
    }

    // Customers can only verify their own payments
    if (req.user.role !== 'admin' && payment.user.toString() !== req.user._id.toString()) {
      const error = new Error('Not authorized to access this payment.');
      error.statusCode = 403;
      return next(error);
    }

    const order = await Order.findById(payment.order);
    if (!order) {
      const error = new Error('Associated order not found.');
      error.statusCode = 404;
      return next(error);
    }

    // If already verified and completed, return current state idempotently
    if (payment.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Payment has already been verified and completed.',
        data: {
          payment,
          order,
        },
      });
    }

    // Check if order was cancelled while customer was on gateway
    if (['cancelled', 'failed'].includes(order.status)) {
      payment.status = 'failed';
      payment.failureReason = `Order was ${order.status} prior to payment completion.`;
      await payment.save();

      const error = new Error(`Order was ${order.status}. Payment cannot be completed.`);
      error.statusCode = 400;
      return next(error);
    }

    // Server-to-server verification with payment provider
    const verification = await paymentService.verifyPayment(
      payment.reference,
      payment.amount,
    );

    // ── Provider verified success ───────────────────────────
    if (verification.success && verification.status === 'success') {
      // Validate that the paid amount returned by provider matches the expected amount
      if (
        typeof verification.amount === 'number' &&
        Math.abs(verification.amount - payment.amount) > 0.01
      ) {
        payment.status = 'failed';
        payment.failureReason = `Amount mismatch: expected ${payment.amount}, received ${verification.amount}`;
        payment.gatewayResponse = verification.gatewayResponse;
        await payment.save();

        const error = new Error(
          'Payment amount mismatch detected. Please contact support.',
        );
        error.statusCode = 400;
        return next(error);
      }

      // Atomically update Payment: only if still pending
      const updatedPayment = await Payment.findOneAndUpdate(
        { _id: payment._id, status: 'pending' },
        {
          status: 'completed',
          transactionId: verification.transactionId,
          paidAt: verification.paidAt || new Date(),
          verifiedAt: new Date(),
          channel: verification.channel || payment.channel,
          gatewayResponse: verification.gatewayResponse,
        },
        { new: true },
      );

      if (updatedPayment) {
        // Transition Order paymentStatus to completed
        order.paymentStatus = 'completed';
        order.paidAt = updatedPayment.paidAt;
        if (verification.channel) {
          order.paymentMethod = verification.channel;
        }
        // Move order from 'pending' to 'processing' upon payment confirmation
        if (order.status === 'pending') {
          order.status = 'processing';
        }
        await order.save();
      }

      const freshPayment = updatedPayment || (await Payment.findById(payment._id));
      const freshOrder = await Order.findById(payment.order);

      return res.status(200).json({
        success: true,
        message: 'Payment verified and confirmed successfully.',
        data: {
          payment: freshPayment,
          order: freshOrder,
        },
      });
    }

    // ── Provider reported failure or abandonment ────────────
    if (verification.status === 'abandoned') {
      payment.status = 'abandoned';
      payment.failureReason = verification.failureReason || 'Payment abandoned by customer.';
      payment.gatewayResponse = verification.gatewayResponse;
      await payment.save();

      return res.status(200).json({
        success: false,
        message: 'Payment was abandoned by the customer.',
        data: {
          payment,
          status: 'abandoned',
        },
      });
    }

    // Payment failed
    payment.status = 'failed';
    payment.failureReason = verification.failureReason || 'Payment verification failed.';
    payment.gatewayResponse = verification.gatewayResponse;
    await payment.save();

    order.paymentStatus = 'failed';
    await order.save();

    return res.status(200).json({
      success: false,
      message: payment.failureReason,
      data: {
        payment,
        status: 'failed',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/payments/my-payments
 * List payment records for the logged-in customer.
 */
router.get('/my-payments', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = { user: req.user._id };
    if (status && PAYMENT_STATUSES.includes(status)) {
      filter.status = status;
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('order', 'orderNumber totalAmount status paymentStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Payment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      message: 'Payments retrieved.',
      data: {
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

/**
 * GET /api/v1/payments/order/:orderId
 * Retrieve payments associated with a specific order.
 */
router.get('/order/:orderId', async (req, res, next) => {
  try {
    const orderId = req.params.orderId.toLowerCase();
    if (!mongoose.isValidObjectId(orderId)) {
      const error = new Error('Invalid order ID.');
      error.statusCode = 400;
      return next(error);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      const error = new Error('Order not found.');
      error.statusCode = 404;
      return next(error);
    }

    if (req.user.role !== 'admin' && order.user.toString() !== req.user._id.toString()) {
      const error = new Error('Not authorized to access payments for this order.');
      error.statusCode = 403;
      return next(error);
    }

    const payments = await Payment.find({ order: orderId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Order payments retrieved.',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          paymentStatus: order.paymentStatus,
          status: order.status,
        },
        payments,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/payments/admin
 * Admin: View all payments with filtering, search, and pagination.
 */
router.get('/admin', authorize('admin'), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      channel,
      search,
      sort = '-createdAt',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (status && PAYMENT_STATUSES.includes(status)) {
      filter.status = status;
    }

    if (channel && typeof channel === 'string' && channel.trim()) {
      filter.channel = channel.trim();
    }

    if (search && typeof search === 'string' && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.reference = new RegExp(escaped, 'i');
    }

    // Whitelist sort fields
    const allowedSort = ['createdAt', 'amount', 'status', 'paidAt'];
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
      Payment.find(filter)
        .populate('user', 'firstName lastName email')
        .populate('order', 'orderNumber totalAmount status paymentStatus')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Payment.countDocuments(filter),
      Payment.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const metrics = {
      completedCount: 0,
      completedAmount: 0,
      pendingCount: 0,
      failedCount: 0,
      abandonedCount: 0,
    };
    for (const s of summary) {
      if (s._id === 'completed') {
        metrics.completedCount = s.count;
        metrics.completedAmount = Math.round(s.totalAmount * 100) / 100;
      } else if (s._id === 'pending') {
        metrics.pendingCount = s.count;
      } else if (s._id === 'failed') {
        metrics.failedCount = s.count;
      } else if (s._id === 'abandoned') {
        metrics.abandonedCount = s.count;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Admin payments retrieved.',
      data: {
        payments,
        metrics,
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

/**
 * GET /api/v1/payments/:id
 * Retrieve a single payment record by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const paymentId = req.params.id.toLowerCase();
    if (!mongoose.isValidObjectId(paymentId)) {
      const error = new Error('Invalid payment ID.');
      error.statusCode = 400;
      return next(error);
    }

    const payment = await Payment.findById(paymentId)
      .populate('user', 'firstName lastName email')
      .populate('order', 'orderNumber totalAmount status paymentStatus shippingAddress');

    if (!payment) {
      const error = new Error('Payment not found.');
      error.statusCode = 404;
      return next(error);
    }

    if (req.user.role !== 'admin' && payment.user._id.toString() !== req.user._id.toString()) {
      const error = new Error('Not authorized to access this payment.');
      error.statusCode = 403;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Payment details retrieved.',
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
