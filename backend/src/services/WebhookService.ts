import {
  WebhookEventRepository,
  OrganizationRepository,
  UserRepository,
  SubscriptionRepository,
  PaymentRepository,
  TransactionRepository,
  PendingRegistrationRepository,
  PlanRepository,
} from '../repositories';
import { stripe, getWebhookSecret } from '../config/stripe';
import {
  SubscriptionStatus,
  PaymentStatus,
  TransactionStatus,
  OrganizationStatus,
  UserRole,
  BillingInterval,
} from '../types';
import mongoose, { Types, startSession } from 'mongoose';
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendSubscriptionUpgradedEmail,
  sendSubscriptionCancelledEmail,
} from '../utils/email';

export class WebhookService {
  constructor(
    private webhookEventRepository: WebhookEventRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private subscriptionRepository: SubscriptionRepository,
    private paymentRepository: PaymentRepository,
    private transactionRepository: TransactionRepository,
    private pendingRegistrationRepository?: PendingRegistrationRepository,
    private planRepository?: PlanRepository
  ) {}

  async handleWebhook(rawBody: string | Buffer, signature: string): Promise<void> {
    const webhookSecret = getWebhookSecret();

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }

    // Check for duplicate events (Idempotency)
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

  private async executeWithTransaction<T>(
    fn: (session?: mongoose.ClientSession) => Promise<T>
  ): Promise<T> {
    let isReplica = false;
    try {
      const hello = await mongoose.connection.db?.command({ hello: 1 });
      isReplica = Boolean(hello?.setName || hello?.msg === 'isdbgrid');
    } catch {
      isReplica = false;
    }

    if (!isReplica) {
      return fn(undefined);
    }

    const session = await startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async syncAndProcessSession(sessionId: string): Promise<boolean> {
    // 1. Check pending registration onboarding flow
    if (this.pendingRegistrationRepository) {
      const pendingReg = await this.pendingRegistrationRepository.findByStripeCheckoutSessionId(sessionId);
      if (pendingReg) {
        if (pendingReg.status === 'COMPLETED') {
          return true;
        }

        // Try retrieving real Stripe session if live key is available
        if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('placeholder')) {
          try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status === 'paid' || session.status === 'complete') {
              await this.handleCheckoutSessionCompleted(session);
              return true;
            }
          } catch (err: any) {
            return false;
          }
        }

        return false;
      }
    }

    // 2. Check existing organization payment / plan change flow
    const payment = await this.paymentRepository.findByStripeCheckoutSessionId(sessionId);
    if (payment) {
      if (payment.status === PaymentStatus.SUCCESS) {
        return true;
      }

      // Try retrieving real Stripe session if live key is available
      if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('placeholder')) {
        try {
          const session = await stripe.checkout.sessions.retrieve(sessionId);
          if (session.payment_status === 'paid' || session.status === 'complete') {
            await this.handleCheckoutSessionCompleted(session);
            return true;
          }
        } catch (err: any) {
          // Fall through to mock session if in non-production/test mode
        }
      }

      // FIX: Process mock checkout session when running in non-production environments.
      // Crucially, resolve the target plan using payment.planId if available, ensuring
      // upgrade or downgrade updates to the intended new plan rather than reverting to the old one.
      if (sessionId.startsWith('cs_test_') && process.env.NODE_ENV !== 'production') {
        const sub = await this.subscriptionRepository.findById(payment.subscriptionId);
        const targetPlanId = payment.planId || sub?.planId;
        const mockSession = {
          id: sessionId,
          payment_status: 'paid',
          status: 'complete',
          amount_total: payment.amount * 100,
          currency: payment.currency,
          customer: 'cus_simulated',
          payment_intent: `pi_simulated_${Date.now()}`,
          metadata: {
            organizationId: payment.organizationId.toString(),
            planId: targetPlanId?.toString(),
          },
        };
        await this.handleCheckoutSessionCompleted(mockSession);
        return true;
      }

      return false;
    }

    // 3. Fallback: try retrieving session from Stripe directly if neither record was indexed yet
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('placeholder')) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session && (session.payment_status === 'paid' || session.status === 'complete')) {
          await this.handleCheckoutSessionCompleted(session);
          return true;
        }
      } catch {
        return false;
      }
    }

    return false;
  }

  async getSessionStatus(sessionId: string): Promise<{
    status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'NOT_FOUND' | 'FAILED';
    organizationName?: string;
    email?: string;
    planName?: string;
    flow?: 'ONBOARDING' | 'PLAN_CHANGE';
    message?: string;
  }> {
    // Flow 1: Pending Onboarding Registration
    if (this.pendingRegistrationRepository) {
      let pendingReg = await this.pendingRegistrationRepository.findByStripeCheckoutSessionId(sessionId);
      if (pendingReg) {
        if (pendingReg.status === 'PENDING') {
          await this.syncAndProcessSession(sessionId);
          pendingReg = await this.pendingRegistrationRepository.findByStripeCheckoutSessionId(sessionId);
        }
        return {
          status: pendingReg?.status === 'COMPLETED' ? 'COMPLETED' : pendingReg?.status || 'PENDING',
          organizationName: pendingReg?.organizationName,
          email: pendingReg?.email,
          flow: 'ONBOARDING',
        };
      }
    }

    // Flow 2: Existing Organization Subscription / Plan Change
    let payment = await this.paymentRepository.findByStripeCheckoutSessionId(sessionId);
    if (payment) {
      if (payment.status === PaymentStatus.PENDING) {
        await this.syncAndProcessSession(sessionId);
        payment = await this.paymentRepository.findByStripeCheckoutSessionId(sessionId);
      }

      if (!payment) {
        return { status: 'NOT_FOUND' };
      }

      const organization = await this.organizationRepository.findById(payment.organizationId);
      const subscription = await this.subscriptionRepository.findById(payment.subscriptionId);
      const plan = subscription && this.planRepository
        ? await this.planRepository.findById(subscription.planId)
        : null;

      if (payment.status === PaymentStatus.SUCCESS) {
        return {
          status: 'COMPLETED',
          organizationName: organization?.name,
          planName: plan?.name,
          flow: 'PLAN_CHANGE',
        };
      } else if (payment.status === PaymentStatus.FAILED) {
        return {
          status: 'FAILED',
          organizationName: organization?.name,
          flow: 'PLAN_CHANGE',
          message: 'Payment was not successful.',
        };
      } else {
        return {
          status: 'PENDING',
          organizationName: organization?.name,
          planName: plan?.name,
          flow: 'PLAN_CHANGE',
        };
      }
    }

    // Fallback sync from Stripe directly
    const synced = await this.syncAndProcessSession(sessionId);
    if (synced) {
      const syncedPayment = await this.paymentRepository.findByStripeCheckoutSessionId(sessionId);
      if (syncedPayment) {
        const organization = await this.organizationRepository.findById(syncedPayment.organizationId);
        const subscription = await this.subscriptionRepository.findById(syncedPayment.subscriptionId);
        const plan = subscription && this.planRepository
          ? await this.planRepository.findById(subscription.planId)
          : null;
        return {
          status: 'COMPLETED',
          organizationName: organization?.name,
          planName: plan?.name,
          flow: 'PLAN_CHANGE',
        };
      }
    }

    return { status: 'NOT_FOUND' };
  }

  async handleCheckoutSessionCompleted(checkoutSession: any): Promise<void> {
    const metadata = checkoutSession.metadata || {};
    const { organizationId, planId, pendingRegistrationId } = metadata;

    let previousOrgStatus: OrganizationStatus | undefined;
    let previousSub: any = null;
    if (organizationId) {
      const prevOrg = await this.organizationRepository.findById(new Types.ObjectId(organizationId));
      previousOrgStatus = prevOrg?.status;
      previousSub = await this.subscriptionRepository.findByOrganizationId(new Types.ObjectId(organizationId));
    }

    let createdOrgId: Types.ObjectId | undefined;
    let createdUserId: Types.ObjectId | undefined;
    let createdSubId: Types.ObjectId | undefined;
    let createdPaymentId: Types.ObjectId | undefined;
    let createdTxId: Types.ObjectId | undefined;

    await this.executeWithTransaction(async (mongoSession) => {
      try {
        // Flow 1: Pending Onboarding Registration
        if (pendingRegistrationId && this.pendingRegistrationRepository) {
          const pendingReg = await this.pendingRegistrationRepository.findById(
            new Types.ObjectId(pendingRegistrationId),
            mongoSession
          );

          if (!pendingReg) {
            throw new Error('Pending registration not found');
          }

          if (pendingReg.status === 'COMPLETED') {
            return;
          }

          // 1. Create Organization with status ACTIVE
          const organization = await this.organizationRepository.create(
            {
              name: pendingReg.organizationName,
              contactEmail: pendingReg.email,
              billingEmail: pendingReg.email,
              status: OrganizationStatus.ACTIVE,
            },
            mongoSession
          );
          createdOrgId = organization._id;

          // 2. Create Admin User with status ACTIVE
          const adminUser = await this.userRepository.create(
            {
              name: pendingReg.adminName,
              email: pendingReg.email,
              password: pendingReg.passwordHash,
              role: UserRole.ORGANIZATION_ADMIN,
              organizationId: organization._id,
              status: 'ACTIVE',
            },
            mongoSession
          );
          createdUserId = adminUser._id;

          // 3. Create Subscription with status ACTIVE
          const targetPlanId = planId ? new Types.ObjectId(planId) : pendingReg.planId;
          const subscription = await this.subscriptionRepository.create(
            {
              organizationId: organization._id,
              planId: targetPlanId,
              status: SubscriptionStatus.ACTIVE,
              stripeSubscriptionId: checkoutSession.subscription,
              stripeCustomerId: checkoutSession.customer,
              currentPeriodStart: new Date(),
            },
            mongoSession
          );
          createdSubId = subscription._id;

          // 4. Create Payment with status SUCCESS
          const amount = checkoutSession.amount_total ? checkoutSession.amount_total / 100 : 0;
          const payment = await this.paymentRepository.create(
            {
              organizationId: organization._id,
              subscriptionId: subscription._id,
              amount,
              currency: checkoutSession.currency || 'usd',
              status: PaymentStatus.SUCCESS,
              stripePaymentIntentId: checkoutSession.payment_intent,
              stripeCheckoutSessionId: checkoutSession.id,
            },
            mongoSession
          );
          createdPaymentId = payment._id;

          // 5. Create Transaction with status SUCCESS
          const tx = await this.transactionRepository.create(
            {
              organizationId: organization._id,
              paymentId: payment._id,
              amount: payment.amount,
              currency: payment.currency,
              description: 'Initial onboarding subscription payment',
              status: TransactionStatus.SUCCESS,
            },
            mongoSession
          );
          createdTxId = tx._id;

          // 6. Mark pending registration completed
          await this.pendingRegistrationRepository.update(
            pendingReg._id,
            { status: 'COMPLETED' },
            mongoSession
          );

          // 7. Send payment success email
          await sendPaymentSuccessEmail(adminUser.email, organization.name, amount);
          return;
        }

        // Flow 2: Existing Organization Subscription
        if (!organizationId || !planId) {
          throw new Error('Missing metadata in checkout session');
        }

        // Activate organization
        const organization = await this.organizationRepository.update(
          new Types.ObjectId(organizationId),
          { status: OrganizationStatus.ACTIVE },
          mongoSession
        );

        if (!organization) {
          throw new Error('Organization not found');
        }

        // Determine renewal period dates based on target plan billing interval
        const plan = this.planRepository
          ? await this.planRepository.findById(new Types.ObjectId(planId))
          : null;
        const periodStart = new Date();
        const periodEnd = new Date(periodStart);
        if (plan?.billingInterval === BillingInterval.YEARLY) {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setDate(periodEnd.getDate() + 30);
        }

        // Create or update subscription
        let subscription = await this.subscriptionRepository.findByOrganizationId(
          new Types.ObjectId(organizationId),
          mongoSession
        );

        if (subscription) {
          subscription = await this.subscriptionRepository.update(
            subscription._id,
            {
              planId: new Types.ObjectId(planId),
              status: SubscriptionStatus.ACTIVE,
              stripeSubscriptionId: checkoutSession.subscription,
              stripeCustomerId: checkoutSession.customer,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
              expiryReminderSent: false,
            },
            mongoSession
          );
        } else {
          subscription = await this.subscriptionRepository.create(
            {
              organizationId: new Types.ObjectId(organizationId),
              planId: new Types.ObjectId(planId),
              status: SubscriptionStatus.ACTIVE,
              stripeSubscriptionId: checkoutSession.subscription,
              stripeCustomerId: checkoutSession.customer,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
            },
            mongoSession
          );
          createdSubId = subscription._id;
        }

        // Update or create payment
        let payment = await this.paymentRepository.findByStripeCheckoutSessionId(
          checkoutSession.id,
          mongoSession
        );

        if (payment) {
          payment = await this.paymentRepository.update(
            payment._id,
            {
              status: PaymentStatus.SUCCESS,
              stripePaymentIntentId: checkoutSession.payment_intent,
            },
            mongoSession
          );

          // Create transaction
          const tx = await this.transactionRepository.create(
            {
              organizationId: new Types.ObjectId(organizationId),
              paymentId: payment!._id,
              amount: payment!.amount,
              currency: payment!.currency,
              description: 'Subscription payment',
              status: TransactionStatus.SUCCESS,
            },
            mongoSession
          );
          createdTxId = tx._id;
        } else {
          const amount = checkoutSession.amount_total ? checkoutSession.amount_total / 100 : 0;
          payment = await this.paymentRepository.create(
            {
              organizationId: new Types.ObjectId(organizationId),
              subscriptionId: subscription!._id,
              amount,
              currency: checkoutSession.currency || 'usd',
              status: PaymentStatus.SUCCESS,
              stripePaymentIntentId: checkoutSession.payment_intent,
              stripeCheckoutSessionId: checkoutSession.id,
            },
            mongoSession
          );
          createdPaymentId = payment._id;

          const tx = await this.transactionRepository.create(
            {
              organizationId: new Types.ObjectId(organizationId),
              paymentId: payment._id,
              amount: payment.amount,
              currency: payment.currency,
              description: 'Subscription payment',
              status: TransactionStatus.SUCCESS,
            },
            mongoSession
          );
          createdTxId = tx._id;
        }

        // Send success email
        const adminUsers = await this.userRepository.findByOrganizationId(new Types.ObjectId(organizationId));
        if (adminUsers && adminUsers.length > 0) {
          await sendPaymentSuccessEmail(
            adminUsers[0].email,
            organization.name,
            (checkoutSession.amount_total || 0) / 100
          );
        }
      } catch (err) {
        // Compensating rollback for standalone mode when no replica set session is active
        if (!mongoSession) {
          if (organizationId && previousOrgStatus) {
            await this.organizationRepository.update(new Types.ObjectId(organizationId), {
              status: previousOrgStatus,
            });
          }
          if (createdTxId) {
            await this.transactionRepository.delete(createdTxId);
          }
          if (createdPaymentId) {
            await this.paymentRepository.delete(createdPaymentId);
          }
          if (createdSubId) {
            await this.subscriptionRepository.delete(createdSubId);
          } else if (previousSub && organizationId) {
            await this.subscriptionRepository.update(previousSub._id, {
              status: previousSub.status,
              planId: previousSub.planId,
            });
          }
          if (createdUserId) {
            await this.userRepository.delete(createdUserId);
          }
          if (createdOrgId) {
            await this.organizationRepository.delete(createdOrgId);
          }
        }
        throw err;
      }
    });
  }

  private async handleCheckoutSessionExpired(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const { organizationId, pendingRegistrationId } = metadata;

    if (pendingRegistrationId && this.pendingRegistrationRepository) {
      await this.pendingRegistrationRepository.update(
        new Types.ObjectId(pendingRegistrationId),
        { status: 'EXPIRED' }
      );
      return;
    }

    if (!organizationId) {
      return;
    }

    const payment = await this.paymentRepository.findByStripeCheckoutSessionId(session.id);
    if (payment) {
      await this.paymentRepository.update(payment._id, {
        status: PaymentStatus.FAILED,
      });
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
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
    console.log('Invoice payment succeeded:', invoice.id);
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
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

      const organization = await this.organizationRepository.findById(dbSubscription.organizationId);
      if (organization) {
        const adminUsers = await this.userRepository.findByOrganizationId(dbSubscription.organizationId);
        if (adminUsers && adminUsers.length > 0) {
          const plan = this.planRepository ? await this.planRepository.findById(dbSubscription.planId) : null;
          await sendSubscriptionUpgradedEmail(adminUsers[0].email, plan?.name || 'Updated Plan');
        }
      }
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
