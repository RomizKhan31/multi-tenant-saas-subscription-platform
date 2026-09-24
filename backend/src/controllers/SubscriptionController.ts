import { Request, Response } from 'express';
import { SubscriptionService } from '../services';
import { z } from 'zod';
import { IAuthRequest } from '../types';
import { Types } from 'mongoose';

const updateSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
});

export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  getSubscription = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const subscription = await this.subscriptionService.getSubscriptionByOrganizationId(organizationId);
      
      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }
      
      res.status(200).json(subscription);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getCurrentPlan = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const plan = await this.subscriptionService.getCurrentPlanByOrganizationId(organizationId);
      if (!plan) {
        res.status(404).json({ error: 'Current plan not found' });
        return;
      }

      res.status(200).json(plan);
    } catch {
      res.status(500).json({ error: 'Unable to load current plan' });
    }
  };

  upgradeSubscription = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const validatedData = updateSubscriptionSchema.parse(req.body);
      if (!Types.ObjectId.isValid(validatedData.planId)) {
        res.status(400).json({ error: 'Invalid plan ID format' });
        return;
      }

      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const subscription = await this.subscriptionService.getSubscriptionByOrganizationId(organizationId);
      
      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      const updatedSubscription = await this.subscriptionService.upgradeSubscription(
        subscription._id,
        new Types.ObjectId(validatedData.planId)
      );
      
      res.status(200).json(updatedSubscription);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0]?.message || 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  downgradeSubscription = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const validatedData = updateSubscriptionSchema.parse(req.body);
      if (!Types.ObjectId.isValid(validatedData.planId)) {
        res.status(400).json({ error: 'Invalid plan ID format' });
        return;
      }

      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const subscription = await this.subscriptionService.getSubscriptionByOrganizationId(organizationId);
      
      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      const updatedSubscription = await this.subscriptionService.downgradeSubscription(
        subscription._id,
        new Types.ObjectId(validatedData.planId)
      );
      
      res.status(200).json(updatedSubscription);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0]?.message || 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  cancelSubscription = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const subscription = await this.subscriptionService.getSubscriptionByOrganizationId(organizationId);
      
      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      const updatedSubscription = await this.subscriptionService.cancelSubscription(subscription._id);
      
      res.status(200).json(updatedSubscription);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getSubscriptions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, organizationId, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const filters: any = {};
      if (status) {
        filters.status = status;
      }
      if (organizationId) {
        if (typeof organizationId === 'string' && Types.ObjectId.isValid(organizationId)) {
          filters.organizationId = new Types.ObjectId(organizationId);
        } else {
          res.status(400).json({ error: 'Invalid organizationId format' });
          return;
        }
      }

      const [subscriptions, total] = await Promise.all([
        this.subscriptionService.getSubscriptions(filters, skip, parseInt(limit as string)),
        this.subscriptionService.countSubscriptions(filters),
      ]);

      res.status(200).json({
        subscriptions,
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

  checkExpiringSubscriptions = async (_req: Request, res: Response): Promise<void> => {
    try {
      const sentCount = await this.subscriptionService.checkExpiringSubscriptions();
      res.status(200).json({ message: 'Expiring subscription check completed', remindersSent: sentCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
