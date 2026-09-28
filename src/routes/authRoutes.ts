import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Public auth endpoints
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected auth endpoints
router.get('/me', authenticate, authController.getMe);

export default router;
