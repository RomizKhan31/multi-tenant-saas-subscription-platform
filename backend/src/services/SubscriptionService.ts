import { SubscriptionRepository } from '../repositories';
import { PlanRepository } from '../repositories';
import { ISubscription, SubscriptionStatus } from '../types';
import { Types } from 'mongoose';

export class SubscriptionService {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private planRepository: PlanRepository
  ) {}

  async createSubscription(subscriptionData: {
    organizationId: Types.ObjectId;
    planId: Types.ObjectId;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
  }): Promise<ISubscription> {
    // Verify plan exists
    const plan = await this.planRepository.findById(subscriptionData.planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    return this.subscriptionRepository.create(subscriptionData);
  }

  async getSubscriptionById(subscriptionId: Types.ObjectId): Promise<ISubscription | null> {
    return this.subscriptionRepository.findById(subscriptionId);
  }

  async getSubscriptionByOrganizationId(organizationId: Types.ObjectId): Promise<ISubscription | null> {
    return this.subscriptionRepository.findByOrganizationId(organizationId);
  }

  async updateSubscription(
    subscriptionId: Types.ObjectId,
    updateData: {
      planId?: Types.ObjectId;
      status?: SubscriptionStatus;
      stripeSubscriptionId?: string;
      stripeCustomerId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
    }
  ): Promise<ISubscription | null> {
    return this.subscriptionRepository.update(subscriptionId, updateData);
  }

  async upgradeSubscription(
    subscriptionId: Types.ObjectId,
    newPlanId: Types.ObjectId
  ): Promise<ISubscription | null> {
    // Verify new plan exists
    const plan = await this.planRepository.findById(newPlanId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    return this.subscriptionRepository.update(subscriptionId, { planId: newPlanId });
  }

  async downgradeSubscription(
    subscriptionId: Types.ObjectId,
    newPlanId: Types.ObjectId
  ): Promise<ISubscription | null> {
    // Verify new plan exists
    const plan = await this.planRepository.findById(newPlanId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    return this.subscriptionRepository.update(subscriptionId, {
      planId: newPlanId,
      cancelAtPeriodEnd: false,
    });
  }

  async cancelSubscription(subscriptionId: Types.ObjectId): Promise<ISubscription | null> {
    return this.subscriptionRepository.update(subscriptionId, {
      status: SubscriptionStatus.CANCELLED,
      cancelAtPeriodEnd: true,
    });
  }

  async getSubscriptions(filters: any = {}, skip = 0, limit = 50): Promise<ISubscription[]> {
    return this.subscriptionRepository.findAll(filters, skip, limit);
  }

  async countSubscriptions(filters: any = {}): Promise<number> {
    return this.subscriptionRepository.count(filters);
  }
}
