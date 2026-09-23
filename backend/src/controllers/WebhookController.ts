import { Request, Response } from 'express';
import { WebhookService } from '../services';

export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const rawBody = req.body;

      if (!signature) {
        res.status(400).json({ error: 'Missing Stripe signature' });
        return;
      }

      await this.webhookService.handleWebhook(rawBody, signature);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: error.message });
    }
  };
}
