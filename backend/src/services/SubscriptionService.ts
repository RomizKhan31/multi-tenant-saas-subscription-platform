import { SubscriptionRepository, PlanRepository, UserRepository, OrganizationRepository } from '../repositories';
import { IPlan, ISubscription, SubscriptionStatus, BillingInterval } from '../types';
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

  /**
   * Upgrades the organization subscription to a higher-tier active plan.
   * FIXES:
   * 1. Validates that the new plan exists AND is currently active.
   * 2. Prevents redundant upgrades if already active on the requested plan.
   * 3. Sets subscription status to ACTIVE (recovering from TRIAL, EXPIRED, or CANCELLED).
   * 4. Resets cancelAtPeriodEnd flag so scheduled cancellations are cleared upon upgrade.
   * 5. Sets currentPeriodStart and computes currentPeriodEnd based on plan billingInterval.
   * 6. Dispatches notification email to organization admin accounts.
   */
  async upgradeSubscription(
    subscriptionId: Types.ObjectId,
    newPlanId: Types.ObjectId
  ): Promise<ISubscription | null> {
    // 1. Verify new plan exists and is active
    const newPlan = await this.planRepository.findById(newPlanId);
    if (!newPlan) {
      throw new Error('Plan not found');
    }
    if (!newPlan.isActive) {
      throw new Error('The selected plan is no longer available');
    }

    // 2. Fetch current subscription to validate change
    const currentSub = await this.subscriptionRepository.findById(subscriptionId);
    if (!currentSub) {
      throw new Error('Subscription not found');
    }

    if (
      currentSub.planId.toString() === newPlanId.toString() &&
      currentSub.status === SubscriptionStatus.ACTIVE &&
      !currentSub.cancelAtPeriodEnd
    ) {
      throw new Error('Already subscribed to this plan');
    }

    // 3. Compute billing cycle period dates for the new tier
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(currentPeriodStart);
    if (newPlan.billingInterval === BillingInterval.YEARLY) {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    }

    // 4. Update subscription record in database
    const updated = await this.subscriptionRepository.update(subscriptionId, {
      planId: newPlanId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      expiryReminderSent: false,
    });

    // 5. Send confirmation email to organization admins
    if (updated && this.userRepository) {
      const admins = await this.userRepository.findByOrganizationId(updated.organizationId);
      if (admins && admins.length > 0) {
        await sendSubscriptionUpgradedEmail(admins[0].email, newPlan.name);
      }
    }
    return updated;
  }

  /**
   * Downgrades the organization subscription to a lower-tier active plan.
   * FIXES:
   * 1. Validates that the requested plan exists and is active.
   * 2. Prevents redundant downgrade calls to the identical plan.
   * 3. Sets status to ACTIVE and clears cancelAtPeriodEnd flag.
   * 4. Retains existing paid period end date if still in the future, avoiding premature cutoff.
   * 5. Dispatches notification email to organization admin accounts.
   */
  async downgradeSubscription(
    subscriptionId: Types.ObjectId,
    newPlanId: Types.ObjectId
  ): Promise<ISubscription | null> {
    // 1. Verify new plan exists and is active
    const newPlan = await this.planRepository.findById(newPlanId);
    if (!newPlan) {
      throw new Error('Plan not found');
    }
    if (!newPlan.isActive) {
      throw new Error('The selected plan is no longer available');
    }

    // 2. Fetch current subscription
    const currentSub = await this.subscriptionRepository.findById(subscriptionId);
    if (!currentSub) {
      throw new Error('Subscription not found');
    }

    if (currentSub.planId.toString() === newPlanId.toString()) {
      throw new Error('Already subscribed to this plan');
    }

    // 3. Retain current paid period end if still in the future, or set 30 days
    const now = new Date();
    let currentPeriodEnd = currentSub.currentPeriodEnd;
    if (!currentPeriodEnd || currentPeriodEnd < now) {
      currentPeriodEnd = new Date(now);
      if (newPlan.billingInterval === BillingInterval.YEARLY) {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      } else {
        currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
      }
    }

    // 4. Update subscription record
    const updated = await this.subscriptionRepository.update(subscriptionId, {
      planId: newPlanId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      expiryReminderSent: false,
    });

    // 5. Send notification email to organization admins
    if (updated && this.userRepository) {
      const admins = await this.userRepository.findByOrganizationId(updated.organizationId);
      if (admins && admins.length > 0) {
        await sendSubscriptionDowngradedEmail(admins[0].email, newPlan.name);
      }
    }
    return updated;
  }

  /**
   * Sets subscription to cancel at the end of the current billing cycle.
   * FIXES:
   * Retains status as ACTIVE until currentPeriodEnd so paid customer benefits remain active,
   * while marking cancelAtPeriodEnd = true to stop automatic renewals.
   */
  async cancelSubscription(subscriptionId: Types.ObjectId, cancelImmediately = false): Promise<ISubscription | null> {
    const currentSub = await this.subscriptionRepository.findById(subscriptionId);
    if (!currentSub) {
      throw new Error('Subscription not found');
    }

    const updated = await this.subscriptionRepository.update(subscriptionId, {
      status: cancelImmediately ? SubscriptionStatus.CANCELLED : SubscriptionStatus.ACTIVE,
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

  /**
   * Reactivates a subscription that was scheduled to cancel at period end.
   * Clears cancelAtPeriodEnd flag, ensures ACTIVE status, and guarantees a valid future period end.
   */
  async reactivateSubscription(subscriptionId: Types.ObjectId): Promise<ISubscription | null> {
    const currentSub = await this.subscriptionRepository.findById(subscriptionId);
    if (!currentSub) {
      throw new Error('Subscription not found');
    }

    const now = new Date();
    let currentPeriodEnd = currentSub.currentPeriodEnd;
    if (!currentPeriodEnd || currentPeriodEnd < now) {
      currentPeriodEnd = new Date(now);
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    }

    const updated = await this.subscriptionRepository.update(subscriptionId, {
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      currentPeriodEnd,
    });

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

  async getCurrentSubscriptionSummary() {
    return this.subscriptionRepository.getCurrentSubscriptionSummary();
  }
}
