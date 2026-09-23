import { Request, Response } from 'express';
import { PlanService } from '../services';
import { z } from 'zod';
import { BillingInterval } from '../types';

const createPlanSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  billingInterval: z.nativeEnum(BillingInterval),
  features: z.array(z.string()),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  billingInterval: z.nativeEnum(BillingInterval).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export class PlanController {
  constructor(private planService: PlanService) {}

  createPlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createPlanSchema.parse(req.body);
      const plan = await this.planService.createPlan(validatedData);
      res.status(201).json(plan);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  getPlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const plan = await this.planService.getPlanById(id as any);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }
      res.status(200).json(plan);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  updatePlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const validatedData = updatePlanSchema.parse(req.body);
      const plan = await this.planService.updatePlan(id as any, validatedData);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }
      res.status(200).json(plan);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  disablePlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const plan = await this.planService.disablePlan(id as any);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }
      res.status(200).json(plan);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  enablePlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const plan = await this.planService.enablePlan(id as any);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }
      res.status(200).json(plan);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getPlans = async (req: Request, res: Response): Promise<void> => {
    try {
      const { isActive, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const filters: any = {};
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }

      const [plans, total] = await Promise.all([
        this.planService.getPlans(filters, skip, parseInt(limit as string)),
        this.planService.countPlans(filters),
      ]);

      res.status(200).json({
        plans,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getActivePlans = async (req: Request, res: Response): Promise<void> => {
    try {
      const plans = await this.planService.getActivePlans();
      res.status(200).json({ plans });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
