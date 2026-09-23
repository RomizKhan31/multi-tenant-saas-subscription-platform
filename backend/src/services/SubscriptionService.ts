import { SubscriptionRepository, PlanRepository, UserRepository, OrganizationRepository } from '../repositories';
import { IPlan, ISubscription, SubscriptionStatus } from '../types';
import { Types } from 'mongoose';
import {
  sendSubscriptionUpgradedEmail,
  sendSubscriptionDowngradedEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionExpiringEmail,
} from '../utils/email';

export class SubscriptionService {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private planRepository: PlanRepository,
    private userRepository?: UserRepository,
    private organizationRepository?: OrganizationRepository
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

  async getCurrentPlanByOrganizationId(
    organizationId: Types.ObjectId
  ): Promise<Pick<IPlan, '_id' | 'name' | 'billingInterval'> | null> {
    const subscription = await this.subscriptionRepository.findByOrganizationId(organizationId);
    if (!subscription) {
      return null;
    }

    const plan = await this.planRepository.findById(subscription.planId);
    if (!plan) {
      return null;
    }

    return { _id: plan._id, name: plan.name, billingInterval: plan.billingInterval };
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

    const updated = await this.subscriptionRepository.update(subscriptionId, { planId: newPlanId });
    if (updated && this.userRepository) {
      const admins = await this.userRepository.findByOrganizationId(updated.organizationId);
      if (admins && admins.length > 0) {
        await sendSubscriptionUpgradedEmail(admins[0].email, plan.name);
      }
    }
    return updated;
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

    const updated = await this.subscriptionRepository.update(subscriptionId, {
      planId: newPlanId,
      cancelAtPeriodEnd: false,
    });
    if (updated && this.userRepository) {
      const admins = await this.userRepository.findByOrganizationId(updated.organizationId);
      if (admins && admins.length > 0) {
        await sendSubscriptionDowngradedEmail(admins[0].email, plan.name);
      }
    }
    return updated;
  }

  async cancelSubscription(subscriptionId: Types.ObjectId): Promise<ISubscription | null> {
    const updated = await this.subscriptionRepository.update(subscriptionId, {
      status: SubscriptionStatus.CANCELLED,
      cancelAtPeriodEnd: true,
    });
    if (updated && this.userRepository) {
      const admins = await this.userRepository.findByOrganizationId(updated.organizationId);
      if (admins && admins.length > 0) {
        await sendSubscriptionCancelledEmail(admins[0].email);
      }
    }
    return updated;
  }

  async checkExpiringSubscriptions(): Promise<number> {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const expiringSubscriptions = await this.subscriptionRepository.findAll({
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { $gte: now, $lte: threeDaysFromNow },
      expiryReminderSent: { $ne: true },
    });

    let sentCount = 0;
    for (const subscription of expiringSubscriptions) {
      if (this.userRepository && subscription.currentPeriodEnd) {
        const admins = await this.userRepository.findByOrganizationId(subscription.organizationId);
        if (admins && admins.length > 0) {
          await sendSubscriptionExpiringEmail(admins[0].email, subscription.currentPeriodEnd);
          await this.subscriptionRepository.update(subscription._id, {
            expiryReminderSent: true,
            expiryReminderSentAt: new Date(),
          });
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  async getSubscriptions(filters: any = {}, skip = 0, limit = 50): Promise<ISubscription[]> {
    return this.subscriptionRepository.findAll(filters, skip, limit);
  }

  async countSubscriptions(filters: any = {}): Promise<number> {
    return this.subscriptionRepository.count(filters);
  }
}
