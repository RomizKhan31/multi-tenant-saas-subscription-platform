import { Router } from 'express';
import { PaymentController } from '../controllers';
import { requireAuth, requireRole, requireOrganizationAccess } from '../middleware/auth';
import { UserRole } from '../types';
import { paymentRateLimiter } from '../middleware/rateLimit';

export const createPaymentRoutes = (paymentController: PaymentController): Router => {
  const router = Router();

  // Organization admin
  router.post('/checkout', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), paymentRateLimiter, paymentController.createCheckoutSession);
  router.get('/', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), paymentController.getPayments);

  // Platform admin
  router.get('/all', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), paymentController.getAllPayments);
  router.get('/:id', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), paymentController.getPayment);

  return router;
};
