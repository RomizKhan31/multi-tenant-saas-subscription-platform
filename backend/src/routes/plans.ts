import { Router } from 'express';
import { PlanController } from '../controllers';
import { requireAuth, requireRole } from '../middleware/auth';
import { UserRole } from '../types';

export const createPlanRoutes = (planController: PlanController): Router => {
  const router = Router();

  // Platform admin only
  router.post('/', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), planController.createPlan);
  router.get('/', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), planController.getPlans);
  router.get('/active', requireAuth, planController.getActivePlans);
  router.get('/:id', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), planController.getPlan);
  router.put('/:id', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), planController.updatePlan);
  router.post('/:id/disable', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), planController.disablePlan);
  router.post('/:id/enable', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), planController.enablePlan);

  return router;
};
