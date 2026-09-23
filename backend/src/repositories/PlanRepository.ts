import { Plan } from '../models';
import { IPlan } from '../types';
import { Types } from 'mongoose';

export class PlanRepository {
  async findById(planId: Types.ObjectId): Promise<IPlan | null> {
    return Plan.findById(planId).lean();
  }

  async create(planData: Partial<IPlan>): Promise<IPlan> {
    const plan = new Plan(planData);
    return plan.save();
  }

  async update(planId: Types.ObjectId, updateData: Partial<IPlan>): Promise<IPlan | null> {
    return Plan.findByIdAndUpdate(planId, updateData, { new: true }).lean();
  }

  async findAll(filters: any = {}, skip = 0, limit = 50): Promise<IPlan[]> {
    return Plan.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
  }

  async count(filters: any = {}): Promise<number> {
    return Plan.countDocuments(filters);
  }

  async delete(planId: Types.ObjectId): Promise<IPlan | null> {
    return Plan.findByIdAndDelete(planId).lean();
  }
}
