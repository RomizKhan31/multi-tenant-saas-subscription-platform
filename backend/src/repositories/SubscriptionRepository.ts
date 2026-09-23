import { Subscription } from '../models';
import { ISubscription } from '../types';
import { Types } from 'mongoose';

export class SubscriptionRepository {
  async findById(subscriptionId: Types.ObjectId): Promise<ISubscription | null> {
    return Subscription.findById(subscriptionId).lean();
  }

  async findByOrganizationId(organizationId: Types.ObjectId): Promise<ISubscription | null> {
    return Subscription.findOne({ organizationId }).lean();
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<ISubscription | null> {
    return Subscription.findOne({ stripeSubscriptionId }).lean();
  }

  async create(subscriptionData: Partial<ISubscription>): Promise<ISubscription> {
    const subscription = new Subscription(subscriptionData);
    return subscription.save();
  }

  async update(subscriptionId: Types.ObjectId, updateData: Partial<ISubscription>): Promise<ISubscription | null> {
    return Subscription.findByIdAndUpdate(subscriptionId, updateData, { new: true }).lean();
  }

  async findAll(filters: any = {}, skip = 0, limit = 50): Promise<ISubscription[]> {
    return Subscription.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
  }

  async count(filters: any = {}): Promise<number> {
    return Subscription.countDocuments(filters);
  }

  async delete(subscriptionId: Types.ObjectId): Promise<ISubscription | null> {
    return Subscription.findByIdAndDelete(subscriptionId).lean();
  }
}
