import { Payment } from '../models';
import { IPayment } from '../types';
import { Types } from 'mongoose';

export class PaymentRepository {
  async findById(paymentId: Types.ObjectId): Promise<IPayment | null> {
    return Payment.findById(paymentId).lean();
  }

  async findByOrganizationId(organizationId: Types.ObjectId, skip = 0, limit = 50): Promise<IPayment[]> {
    return Payment.find({ organizationId })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
  }

  async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<IPayment | null> {
    return Payment.findOne({ stripePaymentIntentId }).lean();
  }

  async findByStripeCheckoutSessionId(stripeCheckoutSessionId: string): Promise<IPayment | null> {
    return Payment.findOne({ stripeCheckoutSessionId }).lean();
  }

  async create(paymentData: Partial<IPayment>): Promise<IPayment> {
    const payment = new Payment(paymentData);
    return payment.save();
  }

  async update(paymentId: Types.ObjectId, updateData: Partial<IPayment>): Promise<IPayment | null> {
    return Payment.findByIdAndUpdate(paymentId, updateData, { new: true }).lean();
  }

  async findAll(filters: any = {}, skip = 0, limit = 50): Promise<IPayment[]> {
    return Payment.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
  }

  async count(filters: any = {}): Promise<number> {
    return Payment.countDocuments(filters);
  }

  async delete(paymentId: Types.ObjectId): Promise<IPayment | null> {
    return Payment.findByIdAndDelete(paymentId).lean();
  }
}
