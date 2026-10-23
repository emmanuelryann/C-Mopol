import Joi from 'joi';

// ── Helper ──────────────────────────────────────────────────────
const objectId = Joi.string().lowercase().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

/**
 * Validation middleware factory.
 * Validates req.body against the given Joi schema.
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const err = new Error('Validation failed');
    err.statusCode = 400;
    err.errors = error.details.map((d) => d.message);
    return next(err);
  }

  req.body = value;
  next();
};

// ─────────────────────────────────────────────────────────────────
//  USER
// ─────────────────────────────────────────────────────────────────

const createUser = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().allow(''),
});

const updateUser = Joi.object({
  firstName: Joi.string().trim().min(2).max(50),
  lastName: Joi.string().trim().min(2).max(50),
  email: Joi.string().email().lowercase().trim(),
  password: Joi.string().min(8),
  phone: Joi.string().allow(''),
}).min(1);

const loginUser = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

// ─────────────────────────────────────────────────────────────────
//  CATEGORY
// ─────────────────────────────────────────────────────────────────

const createCategory = Joi.object({
  name: Joi.string().trim().required(),
  slug: Joi.string().lowercase().required(),
  description: Joi.string().allow(''),
  parent: objectId.allow(null),
  isActive: Joi.boolean(),
});

const updateCategory = Joi.object({
  name: Joi.string().trim(),
  slug: Joi.string().lowercase(),
  description: Joi.string().allow(''),
  parent: objectId.allow(null),
  isActive: Joi.boolean(),
}).min(1);

// ─────────────────────────────────────────────────────────────────
//  PRODUCT
// ─────────────────────────────────────────────────────────────────

const createProduct = Joi.object({
  name: Joi.string().trim().required(),
  slug: Joi.string().lowercase().required(),
  description: Joi.string().required(),
  price: Joi.number().min(0).required(),
  compareAtPrice: Joi.number().min(0),
  category: objectId.required(),
  images: Joi.array().items(Joi.string()),
  stock: Joi.number().integer().min(0),
  sku: Joi.string(),
  isActive: Joi.boolean(),
});

const updateProduct = Joi.object({
  name: Joi.string().trim(),
  slug: Joi.string().lowercase(),
  description: Joi.string(),
  price: Joi.number().min(0),
  compareAtPrice: Joi.number().min(0).allow(null),
  category: objectId,
  images: Joi.array().items(Joi.string()),
  stock: Joi.number().integer().min(0),
  sku: Joi.string(),
}).min(1);

// ─────────────────────────────────────────────────────────────────
//  ADDRESS
// ─────────────────────────────────────────────────────────────────

const createAddress = Joi.object({
  label: Joi.string().valid('home', 'work', 'other'),
  fullName: Joi.string().trim().required(),
  phone: Joi.string().trim().required(),
  addressLine1: Joi.string().trim().required(),
  addressLine2: Joi.string().allow(''),
  city: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
  postalCode: Joi.string().trim().required(),
  country: Joi.string().trim().required(),
  isDefault: Joi.boolean(),
});

const updateAddress = Joi.object({
  label: Joi.string().valid('home', 'work', 'other'),
  fullName: Joi.string().trim(),
  phone: Joi.string().trim(),
  addressLine1: Joi.string().trim(),
  addressLine2: Joi.string().allow(''),
  city: Joi.string().trim(),
  state: Joi.string().trim(),
  postalCode: Joi.string().trim(),
  country: Joi.string().trim(),
  isDefault: Joi.boolean(),
}).min(1);

// ─────────────────────────────────────────────────────────────────
//  CART
// ─────────────────────────────────────────────────────────────────

const addToCart = Joi.object({
  product: objectId.required(),
  quantity: Joi.number().integer().min(1).required(),
});

const updateCartItem = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

// ─────────────────────────────────────────────────────────────────
//  ORDER / CHECKOUT
// ─────────────────────────────────────────────────────────────────

// Inline shipping address for checkout (when not using a saved address)
const shippingAddress = Joi.object({
  fullName: Joi.string().trim().required(),
  phone: Joi.string().trim().required(),
  addressLine1: Joi.string().trim().required(),
  addressLine2: Joi.string().allow(''),
  city: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
  postalCode: Joi.string().trim().required(),
  country: Joi.string().trim().required(),
});

// Checkout: client supplies address + payment method, server computes everything else
const checkout = Joi.object({
  addressId: objectId,
  shippingAddress,
  paymentMethod: Joi.string()
    .valid('card', 'mobile_money', 'bank_transfer', 'cash_on_delivery')
    .required(),
  notes: Joi.string().max(500).allow(''),
})
  .xor('addressId', 'shippingAddress')
  .messages({
    'object.xor': 'Provide either a saved address ID or a shipping address, not both.',
  });

const updateOrderStatus = Joi.object({
  status: Joi.string()
    .valid(
      'pending', 'processing', 'shipped',
      'delivered', 'cancelled', 'failed',
    )
    .required(),
  cancellationReason: Joi.string().max(500).allow(''),
});

const cancelOrder = Joi.object({
  reason: Joi.string().max(500).allow(''),
});

// ─────────────────────────────────────────────────────────────────
//  PAYMENT
// ─────────────────────────────────────────────────────────────────

const initializePayment = Joi.object({
  orderId: objectId.required(),
  callbackUrl: Joi.string().uri().allow(''),
  forceNew: Joi.boolean(),
});

// ─────────────────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────────────────

const adminUpdateUser = Joi.object({
  role: Joi.string().valid('customer', 'admin'),
  status: Joi.string().valid('active', 'suspended', 'deleted'),
}).min(1);

const adminUpdatePaymentStatus = Joi.object({
  paymentStatus: Joi.string()
    .valid('pending', 'completed', 'failed', 'refunded')
    .required(),
});

// ─────────────────────────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────────────────────────

export {
  validate,
  createUser,
  updateUser,
  loginUser,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  createCategory,
  updateCategory,
  createProduct,
  updateProduct,
  createAddress,
  updateAddress,
  addToCart,
  updateCartItem,
  checkout,
  updateOrderStatus,
  cancelOrder,
  initializePayment,
  adminUpdateUser,
  adminUpdatePaymentStatus,
};
