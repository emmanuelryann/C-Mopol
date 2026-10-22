import { Router } from 'express';
import Address from '../models/address.js';
import { authenticate } from '../middlewares/auth.js';
import { validate, createAddress, updateAddress } from '../middlewares/validation.js';

const router = Router();

// All address routes require authentication
router.use(authenticate);

// ── GET / — List all addresses for the logged-in user ───────────

router.get('/', async (req, res, next) => {
  try {
    const addresses = await Address.find({ user: req.user._id })
      .sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Addresses retrieved.',
      data: { addresses },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Get a single address ─────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!address) {
      const error = new Error('Address not found.');
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Address retrieved.',
      data: { address },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create a new address ───────────────────────────────

router.post('/', validate(createAddress), async (req, res, next) => {
  try {
    // If this is set as default, unset any existing default first
    if (req.body.isDefault) {
      await Address.updateMany(
        { user: req.user._id, isDefault: true },
        { isDefault: false },
      );
    }

    // If user has no addresses yet, make this one the default
    const count = await Address.countDocuments({ user: req.user._id });
    if (count === 0) {
      req.body.isDefault = true;
    }

    const address = await Address.create({
      ...req.body,
      user: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Address created.',
      data: { address },
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:id — Update an address ──────────────────────────────

router.patch('/:id', validate(updateAddress), async (req, res, next) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!address) {
      const error = new Error('Address not found.');
      error.statusCode = 404;
      return next(error);
    }

    // If setting as default, unset any existing default first
    if (req.body.isDefault) {
      await Address.updateMany(
        { user: req.user._id, _id: { $ne: address._id }, isDefault: true },
        { isDefault: false },
      );
    } else if (req.body.isDefault === false && address.isDefault) {
      // If unsetting the current default, promote another address if available
      const anotherAddress = await Address.findOne({
        user: req.user._id,
        _id: { $ne: address._id },
      }).sort({ createdAt: -1 });

      if (anotherAddress) {
        anotherAddress.isDefault = true;
        await anotherAddress.save();
      } else {
        // User has only one address, so it must remain default
        req.body.isDefault = true;
      }
    }

    Object.assign(address, req.body);
    await address.save();

    res.status(200).json({
      success: true,
      message: 'Address updated.',
      data: { address },
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id — Delete an address ─────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    const address = await Address.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!address) {
      const error = new Error('Address not found.');
      error.statusCode = 404;
      return next(error);
    }

    // If the deleted address was the default, promote the most recent one
    if (address.isDefault) {
      const next_default = await Address.findOne({ user: req.user._id })
        .sort({ createdAt: -1 });
      if (next_default) {
        next_default.isDefault = true;
        await next_default.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Address deleted.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
