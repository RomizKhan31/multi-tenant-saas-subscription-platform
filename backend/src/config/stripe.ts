import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
});

export const getWebhookSecret = (): string => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'test') {
      return 'whsec_placeholder';
    }
    throw new Error('STRIPE_WEBHOOK_SECRET is not defined in environment variables');
  }
  return webhookSecret;
};
