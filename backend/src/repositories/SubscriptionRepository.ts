import { Subscription } from '../models';
import { ISubscription } from '../types';
import { Types, ClientSession } from 'mongoose';

export class SubscriptionRepository {
  async findById(subscriptionId: Types.ObjectId, session?: ClientSession): Promise<ISubscription | null> {
    const query = Subscription.findById(subscriptionId);
    if (session) query.session(session);
    return query.lean();
  }

  async findByOrganizationId(organizationId: Types.ObjectId, session?: ClientSession): Promise<ISubscription | null> {
    const query = Subscription.findOne({ organizationId });
    if (session) query.session(session);
    return query.lean();
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string, session?: ClientSession): Promise<ISubscription | null> {
    const query = Subscription.findOne({ stripeSubscriptionId });
    if (session) query.session(session);
    return query.lean();
  }

  async create(subscriptionData: Partial<ISubscription>, session?: ClientSession): Promise<ISubscription> {
    const subscription = new Subscription(subscriptionData);
    return subscription.save({ session });
  }

  async update(
    subscriptionId: Types.ObjectId,
    updateData: Partial<ISubscription>,
    session?: ClientSession
  ): Promise<ISubscription | null> {
    return Subscription.findByIdAndUpdate(subscriptionId, updateData, { new: true, session }).lean();
  }

  async findAll(filters: any = {}, skip = 0, limit = 50, session?: ClientSession): Promise<ISubscription[]> {
    const query = Subscription.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    if (session) query.session(session);
    return query.lean();
  }

  async count(filters: any = {}): Promise<number> {
    return Subscription.countDocuments(filters);
  }

  async delete(subscriptionId: Types.ObjectId, session?: ClientSession): Promise<ISubscription | null> {
    return Subscription.findByIdAndDelete(subscriptionId, { session }).lean();
  }
}
