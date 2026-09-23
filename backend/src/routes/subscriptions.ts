import { Router } from 'express';
import { SubscriptionController } from '../controllers';
import { requireAuth, requireRole, requireOrganizationAccess } from '../middleware/auth';
import { UserRole } from '../types';

export const createSubscriptionRoutes = (subscriptionController: SubscriptionController): Router => {
  const router = Router();

  // Organization admin
  router.get('/current-plan', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN, UserRole.ORGANIZATION_MEMBER]), subscriptionController.getCurrentPlan);
  router.get('/', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), subscriptionController.getSubscription);
  router.post('/upgrade', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), subscriptionController.upgradeSubscription);
  router.post('/downgrade', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), subscriptionController.downgradeSubscription);
  router.post('/cancel', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), subscriptionController.cancelSubscription);

  // Platform admin
  router.get('/all', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), subscriptionController.getSubscriptions);

  return router;
};
