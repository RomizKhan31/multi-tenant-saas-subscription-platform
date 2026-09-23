import { PlanRepository } from '../repositories';
import { IPlan, BillingInterval } from '../types';
import { Types } from 'mongoose';

export class PlanService {
  constructor(private planRepository: PlanRepository) {}

  async createPlan(planData: {
    name: string;
    price: number;
    billingInterval: BillingInterval;
    features: string[];
  }): Promise<IPlan> {
    return this.planRepository.create(planData);
  }

  async getPlanById(planId: Types.ObjectId): Promise<IPlan | null> {
    return this.planRepository.findById(planId);
  }

  async updatePlan(
    planId: Types.ObjectId,
    updateData: {
      name?: string;
      price?: number;
      billingInterval?: BillingInterval;
      features?: string[];
      isActive?: boolean;
    }
  ): Promise<IPlan | null> {
    return this.planRepository.update(planId, updateData);
  }

  async disablePlan(planId: Types.ObjectId): Promise<IPlan | null> {
    return this.planRepository.update(planId, { isActive: false });
  }

  async enablePlan(planId: Types.ObjectId): Promise<IPlan | null> {
    return this.planRepository.update(planId, { isActive: true });
  }

  async getPlans(filters: any = {}, skip = 0, limit = 50): Promise<IPlan[]> {
    return this.planRepository.findAll(filters, skip, limit);
  }

  async getActivePlans(): Promise<IPlan[]> {
    return this.planRepository.findAll({ isActive: true });
  }

  async countPlans(filters: any = {}): Promise<number> {
    return this.planRepository.count(filters);
  }
}
