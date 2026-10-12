import mongoose from 'mongoose';

// Embedded snapshot — frozen at the time of purchase
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Product name snapshot is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price snapshot is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    image: {
      type: String,
    },
  },
  { _id: false },
);

// Embedded snapshot — frozen at the time of order
const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, 'Full name is required'] },
    phone: { type: String, required: [true, 'Phone number is required'] },
    addressLine1: { type: String, required: [true, 'Address line 1 is required'] },
    addressLine2: { type: String },
    city: { type: String, required: [true, 'City is required'] },
    state: { type: String, required: [true, 'State is required'] },
    postalCode: { type: String, required: [true, 'Postal code is required'] },
    country: { type: String, required: [true, 'Country is required'] },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'Order must have at least one item'],
      validate: [(val) => val.length > 0, 'Order must have at least one item'],
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, 'Shipping address is required'],
    },
    itemsTotal: {
      type: Number,
      required: [true, 'Items total is required'],
    },
    shippingFee: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
