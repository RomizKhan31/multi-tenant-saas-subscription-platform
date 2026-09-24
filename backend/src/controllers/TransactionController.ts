import { Request, Response } from 'express';
import { TransactionService } from '../services';
import { IAuthRequest } from '../types';
import { Types } from 'mongoose';

const parseObjectId = (id: string | string[] | undefined): Types.ObjectId | null => {
  if (typeof id === 'string' && Types.ObjectId.isValid(id)) {
    return new Types.ObjectId(id);
  }
  return null;
};

export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  getTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
      const txId = parseObjectId(req.params.id);
      if (!txId) {
        res.status(400).json({ error: 'Invalid transaction ID format' });
        return;
      }

      const transaction = await this.transactionService.getTransactionById(txId);
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      res.status(200).json(transaction);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getTransactions = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const { status, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        res.status(403).json({ error: 'No organization associated with user' });
        return;
      }

      const statusFilter = typeof status === 'string' && status.trim() !== '' ? status.trim() : undefined;

      const [transactions, total] = await Promise.all([
        this.transactionService.getTransactionsByOrganizationId(
          organizationId,
          skip,
          parseInt(limit as string),
          statusFilter
        ),
        this.transactionService.countTransactions({ organizationId, ...(statusFilter ? { status: statusFilter } : {}) }),
      ]);

      res.status(200).json({
        transactions,
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

  getAllTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, organizationId, startDate, endDate, page = '1', limit = '50' } = req.query;
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
      if (startDate || endDate) {
        filters.createdAt = {};
        if (startDate) filters.createdAt.$gte = new Date(startDate as string);
        if (endDate) {
          const end = new Date(endDate as string);
          end.setHours(23, 59, 59, 999);
          filters.createdAt.$lte = end;
        }
      }

      const [transactions, total] = await Promise.all([
        this.transactionService.getTransactions(filters, skip, parseInt(limit as string)),
        this.transactionService.countTransactions(filters),
      ]);

      res.status(200).json({
        transactions,
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
