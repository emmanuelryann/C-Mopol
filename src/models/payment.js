import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    method: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: ['card', 'paypal', 'bank_transfer', 'cash_on_delivery'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
