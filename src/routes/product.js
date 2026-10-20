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

// ── Admin Listing Routes (placed before /:id to avoid route collision) ────

// Admin List products (can view all products including inactive/archived)
router.get('/admin', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      minPrice,
      maxPrice,
      active,
      inStock,
      sort = '-createdAt',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    // In admin route, active filter is optional (defaults to showing both active and archived)
    if (active === 'true') filter.isActive = true;
    if (active === 'false') filter.isActive = false;

    if (typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search.trim() };
    }

    if (typeof category === 'string' && mongoose.isValidObjectId(category)) {
      filter.category = category;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const min = parseFloat(minPrice);
      const max = parseFloat(maxPrice);
      if (!isNaN(min) || !isNaN(max)) {
        filter.price = {};
        if (!isNaN(min)) filter.price.$gte = min;
        if (!isNaN(max)) filter.price.$lte = max;
      }
    }

    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
    }

    const allowedSort = ['createdAt', 'price', 'name', 'stock', 'isActive'];
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
        .populate('category', 'name slug isActive')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      message: 'Admin products retrieved.',
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

// Admin Get single product by ID (regardless of active status)
router.get('/admin/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug isActive');

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

    // Filter by category: ensure only products belonging to active categories are shown
    if (typeof category === 'string' && mongoose.isValidObjectId(category)) {
      const cat = await Category.findOne({ _id: category, isActive: true });
      if (!cat) {
        return res.status(200).json({
          success: true,
          message: 'Products retrieved.',
          data: {
            products: [],
            pagination: {
              total: 0,
              page: pageNum,
              limit: limitNum,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
            },
          },
        });
      }
      filter.category = category;
    } else {
      const activeCategories = await Category.find({ isActive: true }).distinct('_id');
      filter.category = { $in: activeCategories };
    }

    // Text search (safe string check)
    if (typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search.trim() };
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

// Get a single active product by ID (only if both product and category are active)
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate({
      path: 'category',
      match: { isActive: true },
      select: 'name slug',
    });

    if (!product || !product.category) {
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

// ── Admin Mutation Routes ───────────────────────────────────────

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

// Restore an archived product (admin)
router.patch('/:id/restore', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      const error = new Error('Product not found.');
      error.statusCode = 404;
      return next(error);
    }

    // Verify category is active before restoring
    const category = await Category.findById(product.category);
    if (!category || !category.isActive) {
      const error = new Error(
        'Cannot restore product because its assigned category is inactive. Restore the category first.',
      );
      error.statusCode = 400;
      return next(error);
    }

    product.isActive = true;
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product restored.',
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
