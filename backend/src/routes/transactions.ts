import { Router } from 'express';
import { TransactionController } from '../controllers';
import { requireAuth, requireRole, requireOrganizationAccess } from '../middleware/auth';
import { UserRole } from '../types';

export const createTransactionRoutes = (transactionController: TransactionController): Router => {
  const router = Router();

  // Organization admin
  router.get('/', requireAuth, requireOrganizationAccess, requireRole([UserRole.ORGANIZATION_ADMIN]), transactionController.getTransactions);

  // Platform admin
  router.get('/all', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), transactionController.getAllTransactions);
  router.get('/:id', requireAuth, requireRole([UserRole.PLATFORM_ADMIN]), transactionController.getTransaction);

  return router;
};
