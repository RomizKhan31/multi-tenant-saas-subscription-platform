import { Transaction } from '../models';
import { ITransaction } from '../types';
import { Types } from 'mongoose';

export class TransactionRepository {
  async findById(transactionId: Types.ObjectId): Promise<ITransaction | null> {
    return Transaction.findById(transactionId).lean();
  }

  async findByOrganizationId(organizationId: Types.ObjectId, skip = 0, limit = 50): Promise<ITransaction[]> {
    return Transaction.find({ organizationId })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(transactionData: Partial<ITransaction>): Promise<ITransaction> {
    const transaction = new Transaction(transactionData);
    return transaction.save();
  }

  async update(transactionId: Types.ObjectId, updateData: Partial<ITransaction>): Promise<ITransaction | null> {
    return Transaction.findByIdAndUpdate(transactionId, updateData, { new: true }).lean();
  }

  async findAll(filters: any = {}, skip = 0, limit = 50): Promise<ITransaction[]> {
    return Transaction.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
  }

  async count(filters: any = {}): Promise<number> {
    return Transaction.countDocuments(filters);
  }

  async delete(transactionId: Types.ObjectId): Promise<ITransaction | null> {
    return Transaction.findByIdAndDelete(transactionId).lean();
  }
}
