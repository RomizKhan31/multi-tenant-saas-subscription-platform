import { Request, Response } from 'express';
import { PaymentService } from '../services';
import { z } from 'zod';
import { IAuthRequest } from '../types';

const createCheckoutSchema = z.object({
  planId: z.string(),
});

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  createCheckoutSession = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const validatedData = createCheckoutSchema.parse(req.body);
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const result = await this.paymentService.createCheckoutSession(
        organizationId,
        validatedData.planId as any,
        req.user.email
      );
      
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  getPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const payment = await this.paymentService.getPaymentById(id as any);
      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      res.status(200).json(payment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getPayments = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const { status, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const [payments, total] = await Promise.all([
        this.paymentService.getPaymentsByOrganizationId(organizationId, skip, parseInt(limit as string)),
        this.paymentService.countPayments({ organizationId, status }),
      ]);

      res.status(200).json({
        payments,
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

  getAllPayments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, organizationId, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const filters: any = {};
      if (status) {
        filters.status = status;
      }
      if (organizationId) {
        filters.organizationId = organizationId;
      }

      const [payments, total] = await Promise.all([
        this.paymentService.getPayments(filters, skip, parseInt(limit as string)),
        this.paymentService.countPayments(filters),
      ]);

      res.status(200).json({
        payments,
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
}
