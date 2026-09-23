import { WebhookEventRepository } from '../repositories';
import { OrganizationRepository } from '../repositories';
import { UserRepository } from '../repositories';
import { SubscriptionRepository } from '../repositories';
import { PaymentRepository } from '../repositories';
import { TransactionRepository } from '../repositories';
import { stripe, getWebhookSecret } from '../config/stripe';
import { SubscriptionStatus, PaymentStatus, TransactionStatus, OrganizationStatus, UserRole } from '../types';
import { Types } from 'mongoose';
import { startSession } from 'mongoose';
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendSubscriptionUpgradedEmail,
  sendSubscriptionDowngradedEmail,
  sendSubscriptionCancelledEmail,
} from '../utils/email';

export class WebhookService {
  constructor(
    private webhookEventRepository: WebhookEventRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private subscriptionRepository: SubscriptionRepository,
    private paymentRepository: PaymentRepository,
    private transactionRepository: TransactionRepository
  ) {}

  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    const webhookSecret = getWebhookSecret();

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }

    // Check for duplicate events
    const existingEvent = await this.webhookEventRepository.findByStripeEventId(event.id);
    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return;
    }

    // Record the webhook event
    await this.webhookEventRepository.create({
      stripeEventId: event.id,
      eventType: event.type,
      processed: false,
    });

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'checkout.session.expired':
          await this.handleCheckoutSessionExpired(event.data.object);
          break;
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Mark event as processed
      await this.webhookEventRepository.markAsProcessed(event.id);
    } catch (error) {
      console.error(`Error processing webhook event ${event.id}:`, error);
      await this.webhookEventRepository.markAsFailed(event.id, (error as Error).message);
      throw error;
    }
  }

  private async handleCheckoutSessionCompleted(checkoutSession: any): Promise<void> {
    const { organizationId, planId } = checkoutSession.metadata;

    if (!organizationId || !planId) {
      throw new Error('Missing metadata in checkout session');
    }

    const mongoSession = await startSession();
    try {
      mongoSession.startTransaction();

      // Activate organization
      const organization = await this.organizationRepository.update(
        new Types.ObjectId(organizationId),
        { status: OrganizationStatus.ACTIVE }
      );

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Create or update subscription
      let subscription = await this.subscriptionRepository.findByOrganizationId(
        new Types.ObjectId(organizationId)
      );

      if (subscription) {
        subscription = await this.subscriptionRepository.update(subscription._id, {
          status: SubscriptionStatus.ACTIVE,
          stripeSubscriptionId: checkoutSession.subscription,
          stripeCustomerId: checkoutSession.customer,
        });
      } else {
        subscription = await this.subscriptionRepository.create({
          organizationId: new Types.ObjectId(organizationId),
          planId: new Types.ObjectId(planId),
          status: SubscriptionStatus.ACTIVE,
          stripeSubscriptionId: checkoutSession.subscription,
          stripeCustomerId: checkoutSession.customer,
        });
      }

      // Update payment
      const payment = await this.paymentRepository.findByStripePaymentIntentId(
        checkoutSession.payment_intent
      );

      if (payment) {
        await this.paymentRepository.update(payment._id, {
          status: PaymentStatus.SUCCESS,
          stripePaymentIntentId: checkoutSession.payment_intent,
        });

        // Create transaction
        await this.transactionRepository.create({
          organizationId: new Types.ObjectId(organizationId),
          paymentId: payment._id,
          amount: payment.amount,
          currency: payment.currency,
          description: 'Initial subscription payment',
          status: TransactionStatus.SUCCESS,
        });
      }

      // Send success email
      const adminUser = await this.userRepository.findByOrganizationId(new Types.ObjectId(organizationId));
      if (adminUser && adminUser.length > 0) {
        await sendPaymentSuccessEmail(adminUser[0].email, organization.name, checkoutSession.amount_total / 100);
      }

      await mongoSession.commitTransaction();
    } catch (error) {
      await mongoSession.abortTransaction();
      throw error;
    } finally {
      mongoSession.endSession();
    }
  }

  private async handleCheckoutSessionExpired(session: any): Promise<void> {
    const { organizationId } = session.metadata;

    if (!organizationId) {
      return;
    }

    // Update payment status to failed
    const payment = await this.paymentRepository.findByStripePaymentIntentId(
      session.payment_intent
    );

    if (payment) {
      await this.paymentRepository.update(payment._id, {
        status: PaymentStatus.FAILED,
      });
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    // This is handled by checkout.session.completed for initial payments
    // For recurring payments, this would be handled by invoice.payment_succeeded
    console.log('Payment intent succeeded:', paymentIntent.id);
  }

  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntent.id);

    if (payment) {
      await this.paymentRepository.update(payment._id, {
        status: PaymentStatus.FAILED,
      });

      // Send failure email
      const organization = await this.organizationRepository.findById(payment.organizationId);
      if (organization) {
        const adminUser = await this.userRepository.findByOrganizationId(payment.organizationId);
        if (adminUser && adminUser.length > 0) {
          await sendPaymentFailedEmail(adminUser[0].email, organization.name);
        }
      }
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    // Handle recurring subscription payments
    console.log('Invoice payment succeeded:', invoice.id);
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    // Handle failed recurring payments
    console.log('Invoice payment failed:', invoice.id);
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const dbSubscription = await this.subscriptionRepository.findByStripeSubscriptionId(
      subscription.id
    );

    if (dbSubscription) {
      await this.subscriptionRepository.update(dbSubscription._id, {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    }
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const dbSubscription = await this.subscriptionRepository.findByStripeSubscriptionId(
      subscription.id
    );

    if (dbSubscription) {
      await this.subscriptionRepository.update(dbSubscription._id, {
        status: SubscriptionStatus.CANCELLED,
      });

      // Send cancellation email
      const organization = await this.organizationRepository.findById(dbSubscription.organizationId);
      if (organization) {
        const adminUser = await this.userRepository.findByOrganizationId(dbSubscription.organizationId);
        if (adminUser && adminUser.length > 0) {
          await sendSubscriptionCancelledEmail(adminUser[0].email);
        }
      }
    }
  }
}
