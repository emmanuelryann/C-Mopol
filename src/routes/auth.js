import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshAccessToken,
  getMe,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.js';
import { authenticate } from '../middlewares/auth.js';
import {
  validate,
  createUser,
  loginUser,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../middlewares/validation.js';

const router = Router();

router.post('/register', validate(createUser), register);
router.post('/login', validate(loginUser), login);
router.post('/logout', authenticate, logout);
router.post('/refresh', refreshAccessToken);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password/:token', validate(resetPasswordSchema), resetPassword);

export default router;
