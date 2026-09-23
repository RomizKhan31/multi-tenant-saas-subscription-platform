import { Payment } from '../models';
import { IPayment } from '../types';
import { Types, ClientSession } from 'mongoose';

export class PaymentRepository {
  async findById(paymentId: Types.ObjectId, session?: ClientSession): Promise<IPayment | null> {
    const query = Payment.findById(paymentId);
    if (session) query.session(session);
    return query.lean();
  }

  async findByOrganizationId(
    organizationId: Types.ObjectId,
    skip = 0,
    limit = 50,
    session?: ClientSession
  ): Promise<IPayment[]> {
    const query = Payment.find({ organizationId })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    if (session) query.session(session);
    return query.lean();
  }

  async findByStripePaymentIntentId(stripePaymentIntentId: string, session?: ClientSession): Promise<IPayment | null> {
    const query = Payment.findOne({ stripePaymentIntentId });
    if (session) query.session(session);
    return query.lean();
  }

  async findByStripeCheckoutSessionId(stripeCheckoutSessionId: string, session?: ClientSession): Promise<IPayment | null> {
    const query = Payment.findOne({ stripeCheckoutSessionId });
    if (session) query.session(session);
    return query.lean();
  }

  async create(paymentData: Partial<IPayment>, session?: ClientSession): Promise<IPayment> {
    const payment = new Payment(paymentData);
    return payment.save({ session });
  }

  async update(
    paymentId: Types.ObjectId,
    updateData: Partial<IPayment>,
    session?: ClientSession
  ): Promise<IPayment | null> {
    return Payment.findByIdAndUpdate(paymentId, updateData, { new: true, session }).lean();
  }

  async findAll(filters: any = {}, skip = 0, limit = 50, session?: ClientSession): Promise<IPayment[]> {
    const query = Payment.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    if (session) query.session(session);
    return query.lean();
  }

  async count(filters: any = {}): Promise<number> {
    return Payment.countDocuments(filters);
  }

  async delete(paymentId: Types.ObjectId, session?: ClientSession): Promise<IPayment | null> {
    return Payment.findByIdAndDelete(paymentId, { session }).lean();
  }
}
