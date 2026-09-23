import { Router } from 'express';
import { AuthController } from '../controllers';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';

export const createAuthRoutes = (authController: AuthController): Router => {
  const router = Router();

  router.post('/register', authRateLimiter, authController.register);
  router.post('/login', authRateLimiter, authController.login);
  router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
  router.post('/reset-password', authRateLimiter, authController.resetPassword);
  router.post('/change-password', requireAuth, authController.changePassword);
  router.put('/profile', requireAuth, authController.updateProfile);

  return router;
};
