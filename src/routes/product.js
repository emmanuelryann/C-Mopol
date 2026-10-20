import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../models/product.js';
import Category from '../models/category.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  validate,
  createProduct,
  updateProduct,
} from '../middlewares/validation.js';

const router = Router();

// ── Public Routes ───────────────────────────────────────────────

// List active products with pagination, search, filtering, and sorting
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      minPrice,
      maxPrice,
      inStock,
      sort = '-createdAt',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Public route only displays active products
    const filter = { isActive: true };

    // Text search (safe string check)
    if (typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search.trim() };
    }

    // Filter by category (safe ObjectId check prevents NoSQL injection)
    if (typeof category === 'string' && mongoose.isValidObjectId(category)) {
      filter.category = category;
    }

    // Filter by price range (safe numeric conversion)
    if (minPrice !== undefined || maxPrice !== undefined) {
      const min = parseFloat(minPrice);
      const max = parseFloat(maxPrice);
      if (!isNaN(min) || !isNaN(max)) {
        filter.price = {};
        if (!isNaN(min)) filter.price.$gte = min;
        if (!isNaN(max)) filter.price.$lte = max;
      }
    }

    // Filter by stock availability
    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
    }

    // Safe sorting with allowed field whitelist
    const allowedSort = ['createdAt', 'price', 'name'];
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

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      message: 'Products retrieved.',
      data: {
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

// Get a single active product by ID
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate('category', 'name slug');

    if (!product) {
      const error = new Error('Product not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Product retrieved.',
      data: { product },
    });
  } catch (err) {
    next(err);
  }
});

// ── Admin Routes ────────────────────────────────────────────────

// Create a product
router.post('/', authenticate, authorize('admin'), validate(createProduct), async (req, res, next) => {
  try {
    // Verify slug is unique
    const existingSlug = await Product.findOne({ slug: req.body.slug });
    if (existingSlug) {
      const error = new Error('A product with this slug already exists.');
      error.statusCode = 409;
      return next(error);
    }

    // Verify SKU is unique if provided
    if (req.body.sku) {
      const existingSku = await Product.findOne({ sku: req.body.sku });
      if (existingSku) {
        const error = new Error('A product with this SKU already exists.');
        error.statusCode = 409;
        return next(error);
      }
    }

    // Verify category exists and is active
    const category = await Category.findById(req.body.category);
    if (!category) {
      const error = new Error('Category not found.');
      error.statusCode = 404;
      return next(error);
    }
    if (!category.isActive) {
      const error = new Error('Cannot assign product to an inactive category.');
      error.statusCode = 400;
      return next(error);
    }

    // Compare-at price validation
    if (req.body.compareAtPrice !== undefined && req.body.compareAtPrice <= req.body.price) {
      const error = new Error('Compare-at price must be greater than the selling price.');
      error.statusCode = 400;
      return next(error);
    }

    const product = await Product.create(req.body);

    const populated = await product.populate('category', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Product created.',
      data: { product: populated },
    });
  } catch (err) {
    next(err);
  }
});

// Update a product
router.patch('/:id', authenticate, authorize('admin'), validate(updateProduct), async (req, res, next) => {
  try {
    // Verify slug is unique if being changed
    if (req.body.slug) {
      const existingSlug = await Product.findOne({
        slug: req.body.slug,
        _id: { $ne: req.params.id },
      });
      if (existingSlug) {
        const error = new Error('A product with this slug already exists.');
        error.statusCode = 409;
        return next(error);
      }
    }

    // Verify SKU is unique if being changed
    if (req.body.sku) {
      const existingSku = await Product.findOne({
        sku: req.body.sku,
        _id: { $ne: req.params.id },
      });
      if (existingSku) {
        const error = new Error('A product with this SKU already exists.');
        error.statusCode = 409;
        return next(error);
      }
    }

    // Verify category exists if being changed
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        const error = new Error('Category not found.');
        error.statusCode = 404;
        return next(error);
      }
      if (!category.isActive) {
        const error = new Error('Cannot assign product to an inactive category.');
        error.statusCode = 400;
        return next(error);
      }
    }

    // Compare-at price validation (need the existing product to compare)
    if (req.body.compareAtPrice !== undefined || req.body.price !== undefined) {
      const existing = await Product.findById(req.params.id);
      if (!existing) {
        const error = new Error('Product not found.');
        error.statusCode = 404;
        return next(error);
      }

      const finalPrice = req.body.price !== undefined ? req.body.price : existing.price;
      const finalCompareAt = req.body.compareAtPrice !== undefined
        ? req.body.compareAtPrice
        : existing.compareAtPrice;

      if (finalCompareAt !== null && finalCompareAt !== undefined && finalCompareAt <= finalPrice) {
        const error = new Error('Compare-at price must be greater than the selling price.');
        error.statusCode = 400;
        return next(error);
      }
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    ).populate('category', 'name slug');

    if (!product) {
      const error = new Error('Product not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Product updated.',
      data: { product },
    });
  } catch (err) {
    next(err);
  }
});

// Delete (archive) a product — soft delete by setting isActive to false
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );

    if (!product) {
      const error = new Error('Product not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Product archived.',
      data: { product },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
