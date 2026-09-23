import { Router } from 'express';
import { WebhookController } from '../controllers';

export const createWebhookRoutes = (webhookController: WebhookController): Router => {
  const router = Router();

  // Stripe webhook endpoint (no auth required, verified via signature)
  router.post('/stripe', webhookController.handleStripeWebhook);

  return router;
};
