import { Router } from 'express';
import mongoose from 'mongoose';
import Category from '../models/category.js';
import Product from '../models/product.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  validate,
  createCategory,
  updateCategory,
} from '../middlewares/validation.js';

const router = Router();

// ── Admin Listing Routes (placed before /:id to avoid route collision) ────

// List all categories for admin (including inactive)
router.get('/admin', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { parent, active } = req.query;
    const filter = {};

    if (active === 'true') filter.isActive = true;
    if (active === 'false') filter.isActive = false;

    if (typeof parent === 'string') {
      if (parent === 'null' || parent === 'root') {
        filter.parent = null;
      } else if (mongoose.isValidObjectId(parent)) {
        filter.parent = parent;
      }
    }

    const categories = await Category.find(filter)
      .populate('parent', 'name slug isActive')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: 'Admin categories retrieved.',
      data: { count: categories.length, categories },
    });
  } catch (err) {
    next(err);
  }
});

// Get single category by ID for admin (regardless of active status)
router.get('/admin/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name slug isActive');

    if (!category) {
      const error = new Error('Category not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Category retrieved.',
      data: { category },
    });
  } catch (err) {
    next(err);
  }
});

// ── Public Routes ───────────────────────────────────────────────

// List active categories (with optional parent filter)
router.get('/', async (req, res, next) => {
  try {
    const { parent } = req.query;

    // Public route only displays active categories
    const filter = { isActive: true };

    if (typeof parent === 'string') {
      if (parent === 'null' || parent === 'root') {
        filter.parent = null;
      } else if (mongoose.isValidObjectId(parent)) {
        filter.parent = parent;
      }
    }

    const categories = await Category.find(filter)
      .populate('parent', 'name slug')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: 'Categories retrieved.',
      data: { count: categories.length, categories },
    });
  } catch (err) {
    next(err);
  }
});

// Get a single active category by ID
router.get('/:id', async (req, res, next) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate('parent', 'name slug');

    if (!category) {
      const error = new Error('Category not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Category retrieved.',
      data: { category },
    });
  } catch (err) {
    next(err);
  }
});

// ── Admin Mutation Routes ───────────────────────────────────────

// Create a category
router.post('/', authenticate, authorize('admin'), validate(createCategory), async (req, res, next) => {
  try {
    // Check for duplicate name or slug
    const existing = await Category.findOne({
      $or: [{ name: req.body.name }, { slug: req.body.slug }],
    });
    if (existing) {
      const error = new Error('A category with this name or slug already exists.');
      error.statusCode = 409;
      return next(error);
    }

    // If parent is provided, verify it exists
    if (req.body.parent) {
      const parentCategory = await Category.findById(req.body.parent);
      if (!parentCategory) {
        const error = new Error('Parent category not found.');
        error.statusCode = 404;
        return next(error);
      }
    }

    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Category created.',
      data: { category },
    });
  } catch (err) {
    next(err);
  }
});

// Update a category
router.patch('/:id', authenticate, authorize('admin'), validate(updateCategory), async (req, res, next) => {
  try {
    // If slug or name is being changed, check for duplicates (excluding current category)
    if (req.body.name || req.body.slug) {
      const conditions = [];
      if (req.body.name) conditions.push({ name: req.body.name });
      if (req.body.slug) conditions.push({ slug: req.body.slug });

      const existing = await Category.findOne({
        $or: conditions,
        _id: { $ne: req.params.id },
      });
      if (existing) {
        const error = new Error('A category with this name or slug already exists.');
        error.statusCode = 409;
        return next(error);
      }
    }

    // If parent is being changed, verify it exists and prevent cycles (self or descendant)
    if (req.body.parent) {
      if (req.body.parent === req.params.id) {
        const error = new Error('A category cannot be its own parent.');
        error.statusCode = 400;
        return next(error);
      }

      const parentCategory = await Category.findById(req.body.parent);
      if (!parentCategory) {
        const error = new Error('Parent category not found.');
        error.statusCode = 404;
        return next(error);
      }

      // Cycle detection: traverse ancestors of target parent to ensure req.params.id is not among them
      let ancestorId = parentCategory.parent;
      while (ancestorId) {
        if (ancestorId.toString() === req.params.id) {
          const error = new Error(
            'Category hierarchy cycle detected (cannot set a descendant as parent).',
          );
          error.statusCode = 400;
          return next(error);
        }
        const ancestor = await Category.findById(ancestorId).select('parent');
        ancestorId = ancestor?.parent;
      }
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    if (!category) {
      const error = new Error('Category not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Category updated.',
      data: { category },
    });
  } catch (err) {
    next(err);
  }
});

// Restore an inactive category (admin)
router.patch('/:id/restore', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true },
    );

    if (!category) {
      const error = new Error('Category not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Category restored.',
      data: { category },
    });
  } catch (err) {
    next(err);
  }
});

// Delete a category
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Check if any products reference this category (both active and archived)
    const [activeCount, archivedCount] = await Promise.all([
      Product.countDocuments({ category: req.params.id, isActive: true }),
      Product.countDocuments({ category: req.params.id, isActive: false }),
    ]);

    const totalProducts = activeCount + archivedCount;
    if (totalProducts > 0) {
      let details = `${totalProducts} product(s)`;
      if (archivedCount > 0) {
        details += ` (${activeCount} active, ${archivedCount} archived)`;
      }
      const error = new Error(
        `Cannot delete this category. It is referenced by ${details}. Reassign or remove them first.`,
      );
      error.statusCode = 400;
      return next(error);
    }

    // Check if any subcategories reference this category
    const childCount = await Category.countDocuments({ parent: req.params.id });
    if (childCount > 0) {
      const error = new Error(
        `Cannot delete this category. It has ${childCount} subcategorie(s). Remove or reassign them first.`,
      );
      error.statusCode = 400;
      return next(error);
    }

    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      const error = new Error('Category not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
