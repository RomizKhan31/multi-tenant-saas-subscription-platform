import { PaymentRepository } from '../repositories';
import { SubscriptionRepository } from '../repositories';
import { IPayment, PaymentStatus } from '../types';
import { Types } from 'mongoose';
import { stripe } from '../config/stripe';

export class PaymentService {
  constructor(
    private paymentRepository: PaymentRepository,
    private subscriptionRepository: SubscriptionRepository
  ) {}

  async createCheckoutSession(
    organizationId: Types.ObjectId,
    planId: Types.ObjectId,
    customerEmail: string
  ): Promise<{ sessionId: string; url: string }> {
    // Verify subscription exists or create pending one
    let subscription = await this.subscriptionRepository.findByOrganizationId(organizationId);
    
    if (!subscription) {
      // This would be handled in the registration flow
      throw new Error('Subscription not found. Please complete registration first.');
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Subscription Plan',
            },
            unit_amount: 2900, // This should come from the plan
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
      amount: 29.00,
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
