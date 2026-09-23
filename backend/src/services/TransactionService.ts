import { TransactionRepository } from '../repositories';
import { PaymentRepository } from '../repositories';
import { ITransaction, TransactionStatus } from '../types';
import { Types } from 'mongoose';
import { startSession } from 'mongoose';

export class TransactionService {
  constructor(
    private transactionRepository: TransactionRepository,
    private paymentRepository: PaymentRepository
  ) {}

  async createTransaction(transactionData: {
    organizationId: Types.ObjectId;
    paymentId: Types.ObjectId;
    amount: number;
    currency: string;
    description?: string;
  }): Promise<ITransaction> {
    return this.transactionRepository.create(transactionData);
  }

  async getTransactionById(transactionId: Types.ObjectId): Promise<ITransaction | null> {
    return this.transactionRepository.findById(transactionId);
  }

  async getTransactionsByOrganizationId(
    organizationId: Types.ObjectId,
    skip = 0,
    limit = 50
  ): Promise<ITransaction[]> {
    return this.transactionRepository.findByOrganizationId(organizationId, skip, limit);
  }

  async updateTransaction(
    transactionId: Types.ObjectId,
    updateData: {
      status?: TransactionStatus;
      description?: string;
    }
  ): Promise<ITransaction | null> {
    return this.transactionRepository.update(transactionId, updateData);
  }

  async getTransactions(filters: any = {}, skip = 0, limit = 50): Promise<ITransaction[]> {
    return this.transactionRepository.findAll(filters, skip, limit);
  }

  async countTransactions(filters: any = {}): Promise<number> {
    return this.transactionRepository.count(filters);
  }

  async processPaymentWithTransaction(
    paymentId: Types.ObjectId,
    organizationId: Types.ObjectId,
    amount: number,
    currency: string,
    description?: string
  ): Promise<{ payment: any; transaction: ITransaction }> {
    const session = await startSession();

    try {
      session.startTransaction();

      // Update payment status
      const payment = await this.paymentRepository.update(paymentId, {
        status: 'SUCCESS' as any,
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Create transaction
      const transaction = await this.transactionRepository.create({
        organizationId,
        paymentId,
        amount,
        currency,
        description,
        status: TransactionStatus.SUCCESS,
      });

      await session.commitTransaction();

      return { payment, transaction };
    } catch (error) {
      await session.abortTransaction();

      // Rollback payment status
      await this.paymentRepository.update(paymentId, {
        status: 'ROLLED_BACK' as any,
      });

      // Create failed transaction
      await this.transactionRepository.create({
        organizationId,
        paymentId,
        amount,
        currency,
        description: description || 'Payment failed - transaction rolled back',
        status: TransactionStatus.ROLLED_BACK,
      });

      throw error;
    } finally {
      session.endSession();
    }
  }
}
