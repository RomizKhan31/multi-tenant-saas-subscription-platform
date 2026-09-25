import { Subscription } from '../models';
import { ISubscription } from '../types';
import { Types, ClientSession } from 'mongoose';

export class SubscriptionRepository {
  /**
   * Returns counts from the database, rather than from a paginated list.
   * If a legacy data set contains more than one record for an organization,
   * only its most recently updated subscription represents its current state.
   */
  async getCurrentSubscriptionSummary(): Promise<{
    total: number;
    active: number;
    activeByPlan: Array<{ planId: Types.ObjectId; count: number }>;
  }> {
    const [summary] = await Subscription.aggregate([
      { $sort: { organizationId: 1, updatedAt: -1, createdAt: -1, _id: -1 } },
      { $group: { _id: '$organizationId', subscription: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$subscription' } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: {
                  $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] },
                },
              },
            },
          ],
          activeByPlan: [
            { $match: { status: 'ACTIVE' } },
            { $group: { _id: '$planId', count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const totals = summary?.totals?.[0];
    return {
      total: totals?.total ?? 0,
      active: totals?.active ?? 0,
      activeByPlan: (summary?.activeByPlan ?? []).map((item: { _id: Types.ObjectId; count: number }) => ({
        planId: item._id,
        count: item.count,
      })),
    };
  }

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
