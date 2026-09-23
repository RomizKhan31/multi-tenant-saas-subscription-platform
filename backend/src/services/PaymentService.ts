import { PaymentRepository } from '../repositories';
import { SubscriptionRepository } from '../repositories';
import { PlanRepository } from '../repositories';
import { IPayment, PaymentStatus, SubscriptionStatus } from '../types';
import { Types } from 'mongoose';
import { stripe } from '../config/stripe';

export class PaymentService {
  constructor(
    private paymentRepository: PaymentRepository,
    private subscriptionRepository: SubscriptionRepository,
    private planRepository: PlanRepository
  ) {}

  async createCheckoutSession(
    organizationId: Types.ObjectId,
    planId: Types.ObjectId,
    customerEmail: string
  ): Promise<{ sessionId: string; url: string }> {
    const plan = await this.planRepository.findById(planId);
    if (!plan || !plan.isActive) {
      throw new Error('The selected plan is no longer available');
    }

    // A first checkout legitimately has no subscription yet. Create its pending
    // record before redirecting to Stripe; the webhook is still authoritative for activation.
    let subscription = await this.subscriptionRepository.findByOrganizationId(organizationId);
    if (!subscription) {
      subscription = await this.subscriptionRepository.create({
        organizationId,
        planId,
        status: SubscriptionStatus.PENDING,
      });
    } else if (subscription.status === SubscriptionStatus.CANCELLED || subscription.status === SubscriptionStatus.FAILED || subscription.status === SubscriptionStatus.PENDING) {
      subscription = await this.subscriptionRepository.update(subscription._id, {
        planId,
        status: SubscriptionStatus.PENDING,
        cancelAtPeriodEnd: false,
      }) ?? subscription;
    }

    // Create Stripe checkout session
    let sessionId = `cs_test_${Date.now()}`;
    let sessionUrl = `${process.env.FRONTEND_URL}/payment/success?session_id=${sessionId}`;

    if (
      process.env.NODE_ENV !== 'test' &&
      process.env.STRIPE_SECRET_KEY &&
      !process.env.STRIPE_SECRET_KEY.includes('placeholder')
    ) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: plan.name,
              },
              unit_amount: Math.round(plan.price * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        customer_email: customerEmail,
        metadata: {
          organizationId: organizationId.toString(),
          planId: planId.toString(),
        },
      });
      sessionId = session.id;
      sessionUrl = session.url || '';
    }

    // Create pending payment record
    await this.paymentRepository.create({
      organizationId,
      subscriptionId: subscription._id,
      amount: plan.price,
      currency: 'usd',
      status: PaymentStatus.PENDING,
      stripeCheckoutSessionId: sessionId,
    });

    return {
      sessionId,
      url: sessionUrl,
    };

  }

  async getPaymentById(paymentId: Types.ObjectId): Promise<IPayment | null> {
    return this.paymentRepository.findById(paymentId);
  }

  async getPaymentsByOrganizationId(
    organizationId: Types.ObjectId,
    skip = 0,
    limit = 50
  ): Promise<IPayment[]> {
    return this.paymentRepository.findByOrganizationId(organizationId, skip, limit);
  }

  async updatePayment(
    paymentId: Types.ObjectId,
    updateData: {
      status?: PaymentStatus;
      stripePaymentIntentId?: string;
    }
  ): Promise<IPayment | null> {
    return this.paymentRepository.update(paymentId, updateData);
  }

  async getPayments(filters: any = {}, skip = 0, limit = 50): Promise<IPayment[]> {
    return this.paymentRepository.findAll(filters, skip, limit);
  }

  async countPayments(filters: any = {}): Promise<number> {
    return this.paymentRepository.count(filters);
  }

  async getInvoiceData(paymentId: Types.ObjectId, organizationId?: Types.ObjectId): Promise<any> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (organizationId && payment.organizationId.toString() !== organizationId.toString()) {
      throw new Error('Unauthorized access to payment invoice');
    }

    const subscription = await this.subscriptionRepository.findById(payment.subscriptionId);
    const plan = subscription ? await this.planRepository.findById(subscription.planId) : null;

    return {
      invoiceNumber: `INV-${payment._id.toString().slice(-8).toUpperCase()}`,
      paymentId: payment._id,
      organizationId: payment.organizationId,
      date: payment.createdAt,
      amount: payment.amount,
      currency: payment.currency.toUpperCase(),
      status: payment.status,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
      planName: plan?.name || 'Subscription Plan',
      billingInterval: plan?.billingInterval || 'MONTHLY',
    };
  }
}

