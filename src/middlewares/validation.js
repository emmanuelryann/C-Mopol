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
  user: objectId.required(),
  label: Joi.string().valid('home', 'work', 'other'),
  fullName: Joi.string().required(),
  phone: Joi.string().required(),
  addressLine1: Joi.string().required(),
  addressLine2: Joi.string().allow(''),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postalCode: Joi.string().required(),
  country: Joi.string().required(),
  isDefault: Joi.boolean(),
});

const updateAddress = Joi.object({
  label: Joi.string().valid('home', 'work', 'other'),
  fullName: Joi.string(),
  phone: Joi.string(),
  addressLine1: Joi.string(),
  addressLine2: Joi.string().allow(''),
  city: Joi.string(),
  state: Joi.string(),
  postalCode: Joi.string(),
  country: Joi.string(),
  isDefault: Joi.boolean(),
}).min(1);

// ─────────────────────────────────────────────────────────────────
//  CART
// ─────────────────────────────────────────────────────────────────

const cartItem = Joi.object({
  product: objectId.required(),
  quantity: Joi.number().integer().min(1).required(),
});

const addToCart = Joi.object({
  product: objectId.required(),
  quantity: Joi.number().integer().min(1).required(),
});

const updateCartItem = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

// ─────────────────────────────────────────────────────────────────
//  ORDER
// ─────────────────────────────────────────────────────────────────

const orderItem = Joi.object({
  product: objectId.required(),
  name: Joi.string().required(),
  price: Joi.number().required(),
  quantity: Joi.number().integer().min(1).required(),
  image: Joi.string().allow(''),
});

const shippingAddress = Joi.object({
  fullName: Joi.string().required(),
  phone: Joi.string().required(),
  addressLine1: Joi.string().required(),
  addressLine2: Joi.string().allow(''),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postalCode: Joi.string().required(),
  country: Joi.string().required(),
});

const createOrder = Joi.object({
  user: objectId.required(),
  orderNumber: Joi.string().required(),
  items: Joi.array().items(orderItem).min(1).required(),
  shippingAddress: shippingAddress.required(),
  itemsTotal: Joi.number().required(),
  shippingFee: Joi.number().min(0),
  tax: Joi.number().min(0),
  totalAmount: Joi.number().required(),
  status: Joi.string().valid(
    'pending', 'confirmed', 'processing', 'shipped',
    'delivered', 'cancelled', 'refunded',
  ),
});

const updateOrderStatus = Joi.object({
  status: Joi.string()
    .valid(
      'pending', 'confirmed', 'processing', 'shipped',
      'delivered', 'cancelled', 'refunded',
    )
    .required(),
});

// ─────────────────────────────────────────────────────────────────
//  PAYMENT
// ─────────────────────────────────────────────────────────────────

const createPayment = Joi.object({
  order: objectId.required(),
  user: objectId.required(),
  method: Joi.string()
    .valid('card', 'paypal', 'bank_transfer', 'cash_on_delivery')
    .required(),
  status: Joi.string().valid('pending', 'completed', 'failed', 'refunded'),
  amount: Joi.number().min(0).required(),
  transactionId: Joi.string(),
  paidAt: Joi.date(),
});

const updatePayment = Joi.object({
  status: Joi.string().valid('pending', 'completed', 'failed', 'refunded'),
  transactionId: Joi.string(),
  paidAt: Joi.date(),
}).min(1);

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
  createOrder,
  updateOrderStatus,
  createPayment,
  updatePayment,
};
