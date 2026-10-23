import mongoose from 'mongoose';

const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'abandoned', 'refunded'];

const processedWebhookSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      trim: true,
    },
    event: {
      type: String,
      trim: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required.'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required.'],
      index: true,
    },
    reference: {
      type: String,
      required: [true, 'Payment reference is required.'],
      unique: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required.'],
      min: [0, 'Payment amount cannot be negative.'],
    },
    currency: {
      type: String,
      default: 'GHS',
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    channel: {
      type: String,
      default: 'card',
      trim: true,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    authorizationUrl: {
      type: String,
      trim: true,
    },
    accessCode: {
      type: String,
      trim: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      select: false,
    },
    paidAt: {
      type: Date,
    },
    verifiedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    processedWebhooks: [processedWebhookSchema],
  },
  { timestamps: true },
);

paymentSchema.index({ order: 1, createdAt: -1 });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index(
  { order: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

const Payment = mongoose.model('Payment', paymentSchema);

export { PAYMENT_STATUSES };
export default Payment;
