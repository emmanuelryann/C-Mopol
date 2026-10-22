import { Router } from 'express';
import Cart from '../models/cart.js';
import Product from '../models/product.js';
import { authenticate } from '../middlewares/auth.js';
import { validate, addToCart, updateCartItem } from '../middlewares/validation.js';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Populate cart items with product data and compute server-side totals.
 * Strips items whose product no longer exists, is inactive, or belongs
 * to an inactive category (stale items). Returns the cleaned cart
 * alongside computed totals.
 */
const buildCartResponse = async (cart) => {
  // Capture raw product IDs before population so that if any product was
  // hard-deleted, its ID is preserved for individual removal from the cart.
  const rawProductIds = cart.items.map((item) =>
    (item.product?._id || item.product).toString(),
  );

  await cart.populate({
    path: 'items.product',
    select: 'name slug price compareAtPrice images stock isActive category',
    populate: {
      path: 'category',
      select: 'name slug isActive',
    },
  });

  // Separate valid items from stale ones (inactive product, missing
  // product, or inactive category). We don't silently remove them from
  // the DB here — we just exclude them from the response and flag them
  // so the frontend can show "some items became unavailable".
  const validItems = [];
  const unavailableItems = [];

  for (let idx = 0; idx < cart.items.length; idx++) {
    const item = cart.items[idx];
    const product = item.product;
    const rawProductId = rawProductIds[idx];

    if (!product || !product.isActive || !product.category || !product.category.isActive) {
      unavailableItems.push({
        product: product?._id?.toString() || rawProductId,
        reason: !product
          ? 'Product no longer exists.'
          : !product.isActive
            ? 'Product is no longer available.'
            : 'Product category is no longer available.',
      });
      continue;
    }

    validItems.push({
      product: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        images: product.images,
        stock: product.stock,
        category: product.category,
      },
      quantity: item.quantity,
      lineTotal: product.price * item.quantity,
    });
  }

  const itemCount = validItems.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = validItems.reduce((sum, i) => sum + i.lineTotal, 0);

  return {
    _id: cart._id,
    items: validItems,
    itemCount,
    subtotal,
    ...(unavailableItems.length > 0 && { unavailableItems }),
    updatedAt: cart.updatedAt,
  };
};

// ── GET / — Retrieve the cart ───────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: 'Cart retrieved.',
        data: {
          cart: {
            _id: null,
            items: [],
            itemCount: 0,
            subtotal: 0,
          },
        },
      });
    }

    const cartData = await buildCartResponse(cart);

    res.status(200).json({
      success: true,
      message: 'Cart retrieved.',
      data: { cart: cartData },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /items — Add a product to the cart ─────────────────────

router.post('/items', validate(addToCart), async (req, res, next) => {
  try {
    const { product: productId, quantity } = req.body;

    // Verify product exists and is active
    const product = await Product.findById(productId).populate('category', 'isActive');

    if (!product || !product.isActive) {
      const error = new Error('Product not found or is no longer available.');
      error.statusCode = 404;
      return next(error);
    }

    // Verify category is active
    if (!product.category || !product.category.isActive) {
      const error = new Error('This product is currently unavailable.');
      error.statusCode = 400;
      return next(error);
    }

    // Find or create cart for this user
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if product is already in the cart
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId,
    );

    const newQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    // Validate stock
    if (product.stock < newQuantity) {
      const error = new Error(
        `Insufficient stock. Only ${product.stock} unit(s) available.`,
      );
      error.statusCode = 400;
      return next(error);
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    try {
      await cart.save();
    } catch (saveErr) {
      // Handle double-click race: if concurrent request created the cart first
      if (saveErr.code === 11000) {
        cart = await Cart.findOne({ user: req.user._id });
        if (!cart) throw saveErr;

        const raceItem = cart.items.find(
          (item) => item.product.toString() === productId,
        );
        if (raceItem) {
          raceItem.quantity = Math.min(product.stock, raceItem.quantity + quantity);
        } else {
          cart.items.push({ product: productId, quantity });
        }
        await cart.save();
      } else {
        throw saveErr;
      }
    }

    const cartData = await buildCartResponse(cart);

    res.status(200).json({
      success: true,
      message: existingItem
        ? 'Cart item quantity updated.'
        : 'Product added to cart.',
      data: { cart: cartData },
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /items/:productId — Update item quantity ──────────────

router.patch('/items/:productId', validate(updateCartItem), async (req, res, next) => {
  try {
    const productId = req.params.productId.toLowerCase();
    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      const error = new Error('Cart not found.');
      error.statusCode = 404;
      return next(error);
    }

    const item = cart.items.find(
      (i) => i.product.toString() === productId,
    );

    if (!item) {
      const error = new Error('Item not found in cart.');
      error.statusCode = 404;
      return next(error);
    }

    // Validate product and category availability
    const product = await Product.findById(productId).populate('category', 'isActive');

    if (!product || !product.isActive) {
      const error = new Error('Product is no longer available.');
      error.statusCode = 400;
      return next(error);
    }

    if (!product.category || !product.category.isActive) {
      const error = new Error('This product is currently unavailable.');
      error.statusCode = 400;
      return next(error);
    }

    if (product.stock < quantity) {
      const error = new Error(
        `Insufficient stock. Only ${product.stock} unit(s) available.`,
      );
      error.statusCode = 400;
      return next(error);
    }

    item.quantity = quantity;
    await cart.save();

    const cartData = await buildCartResponse(cart);

    res.status(200).json({
      success: true,
      message: 'Cart item updated.',
      data: { cart: cartData },
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /items/:productId — Remove a single item ─────────────

router.delete('/items/:productId', async (req, res, next) => {
  try {
    const productId = req.params.productId.toLowerCase();

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      const error = new Error('Cart not found.');
      error.statusCode = 404;
      return next(error);
    }

    const itemIndex = cart.items.findIndex(
      (i) => i.product.toString() === productId,
    );

    if (itemIndex === -1) {
      const error = new Error('Item not found in cart.');
      error.statusCode = 404;
      return next(error);
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    const cartData = await buildCartResponse(cart);

    res.status(200).json({
      success: true,
      message: 'Item removed from cart.',
      data: { cart: cartData },
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE / — Clear the entire cart ────────────────────────────

router.delete('/', async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: 'Cart is already empty.',
        data: {
          cart: {
            _id: null,
            items: [],
            itemCount: 0,
            subtotal: 0,
          },
        },
      });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared.',
      data: {
        cart: {
          _id: cart._id,
          items: [],
          itemCount: 0,
          subtotal: 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
