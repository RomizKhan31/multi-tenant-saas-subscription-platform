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

    // Create pending payment record
    await this.paymentRepository.create({
      organizationId,
      subscriptionId: subscription._id,
      amount: plan.price,
      currency: 'usd',
      status: PaymentStatus.PENDING,
      stripeCheckoutSessionId: session.id,
    });

    return {
      sessionId: session.id,
      url: session.url || '',
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
}
