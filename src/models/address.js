import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    label: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'home',
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 is required'],
    },
    addressLine2: {
      type: String,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

addressSchema.index({ user: 1 });

const Address = mongoose.model('Address', addressSchema);

export default Address;
