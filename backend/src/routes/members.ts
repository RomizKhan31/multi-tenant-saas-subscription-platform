import { Router } from 'express';
import { MemberController } from '../controllers';
import { requireAuth, requireRole, requireOrganizationAccess } from '../middleware/auth';
import { UserRole } from '../types';
import { invitationRateLimiter } from '../middleware/rateLimit';

export const createMemberRoutes = (memberController: MemberController): Router => {
  const router = Router();

  // Public endpoint for accepting invitations
  router.post('/accept', memberController.acceptInvitation);

  // Organization admin
  router.post('/invite', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), invitationRateLimiter, memberController.inviteMember);
  router.delete('/:userId', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), memberController.removeMember);
  router.put('/:userId/role', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), memberController.changeMemberRole);
  router.get('/', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN, UserRole.ORGANIZATION_MEMBER]), memberController.getOrganizationMembers);

  return router;
};
