import { Request, Response } from 'express';
import { PaymentService } from '../services';
import { z } from 'zod';
import { IAuthRequest } from '../types';
import { Types } from 'mongoose';

const createCheckoutSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
});

const parseObjectId = (id: string | string[] | undefined): Types.ObjectId | null => {
  if (typeof id === 'string' && Types.ObjectId.isValid(id)) {
    return new Types.ObjectId(id);
  }
  return null;
};

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  createCheckoutSession = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const validatedData = createCheckoutSchema.parse(req.body);
      if (!Types.ObjectId.isValid(validatedData.planId)) {
        res.status(400).json({ error: 'Invalid plan ID format' });
        return;
      }

      const organizationId = req.user?.organizationId;
      const userEmail = req.user?.email;
      
      if (!organizationId || !userEmail) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const result = await this.paymentService.createCheckoutSession(
        organizationId,
        new Types.ObjectId(validatedData.planId),
        userEmail
      );
      
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        console.error('Unable to create Stripe checkout session:', error);
        const message = error.message === 'The selected plan is no longer available'
          ? error.message
          : 'Checkout is temporarily unavailable. Please try again shortly.';
        res.status(500).json({ error: message });
      }
    }
  };

  getPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const paymentId = parseObjectId(req.params.id);
      if (!paymentId) {
        res.status(400).json({ error: 'Invalid payment ID format' });
        return;
      }

      const payment = await this.paymentService.getPaymentById(paymentId);
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

      const statusFilter = typeof status === 'string' && status.trim() !== '' ? status.trim() : undefined;

      const [payments, total] = await Promise.all([
        this.paymentService.getPaymentsByOrganizationId(
          organizationId,
          skip,
          parseInt(limit as string),
          statusFilter
        ),
        this.paymentService.countPayments({
          organizationId,
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
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
        if (typeof organizationId === 'string' && Types.ObjectId.isValid(organizationId)) {
          filters.organizationId = new Types.ObjectId(organizationId);
        } else {
          res.status(400).json({ error: 'Invalid organizationId format' });
          return;
        }
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

  getInvoice = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Invoice or payment ID is required' });
        return;
      }

      const isPlatformAdmin = req.user?.role === 'PLATFORM_ADMIN';
      const organizationId = isPlatformAdmin ? undefined : req.user?.organizationId;

      if (!isPlatformAdmin && !organizationId) {
        res.status(403).json({ error: 'Unauthorized access to payment invoice' });
        return;
      }

      const invoice = await this.paymentService.getInvoiceData(id as any, organizationId);
      res.status(200).json({
        ...invoice,
        invoice,
      });
    } catch (error: any) {
      if (error.message.includes('Unauthorized')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };
}
