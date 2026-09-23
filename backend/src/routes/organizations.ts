import { Router } from 'express';
import { OrganizationController } from '../controllers';
import { requireAuth, requireRole } from '../middleware/auth';
import { UserRole } from '../types';

export const createOrganizationRoutes = (organizationController: OrganizationController): Router => {
  const router = Router();

  // Platform admin only
  router.get('/', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), organizationController.getOrganizations);
  router.get('/current', requireAuth, requireRole([UserRole.ORGANIZATION_ADMIN, UserRole.ORGANIZATION_MEMBER]), organizationController.getCurrentOrganization);
  router.get('/:id', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), organizationController.getOrganization);
  router.get('/:id/members', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), organizationController.getOrganizationMembers);
  router.post('/:id/suspend', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), organizationController.suspendOrganization);
  router.post('/:id/reactivate', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), organizationController.reactivateOrganization);

  // Organization admin
  router.put('/profile', requireAuth, requireRole([UserRole.ORGANIZATION_ADMIN]), organizationController.updateOrganization);

  return router;
};
