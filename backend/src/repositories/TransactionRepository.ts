import { Transaction } from '../models';
import { ITransaction } from '../types';
import { Types, ClientSession } from 'mongoose';

export class TransactionRepository {
  async getDashboardSummary(): Promise<{ totalRevenue: number; pending: number; failed: number }> {
    const [summary] = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
        },
      },
    ]);
    return { totalRevenue: summary?.totalRevenue ?? 0, pending: summary?.pending ?? 0, failed: summary?.failed ?? 0 };
  }

  async findById(transactionId: Types.ObjectId, session?: ClientSession): Promise<ITransaction | null> {
    const query = Transaction.findById(transactionId);
    if (session) query.session(session);
    return query.lean();
  }

  async findByOrganizationId(
    organizationId: Types.ObjectId,
    skip = 0,
    limit = 50,
    session?: ClientSession,
    status?: string
  ): Promise<ITransaction[]> {
    const filter: any = { organizationId };
    if (status) {
      filter.status = status;
    }
    const query = Transaction.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    if (session) query.session(session);
    return query.lean();
  }

  async create(transactionData: Partial<ITransaction>, session?: ClientSession): Promise<ITransaction> {
    const transaction = new Transaction(transactionData);
    return transaction.save({ session });
  }

  async update(
    transactionId: Types.ObjectId,
    updateData: Partial<ITransaction>,
    session?: ClientSession
  ): Promise<ITransaction | null> {
    return Transaction.findByIdAndUpdate(transactionId, updateData, { new: true, session }).lean();
  }

  async findAll(filters: any = {}, skip = 0, limit = 50, session?: ClientSession): Promise<ITransaction[]> {
    const query = Transaction.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    if (session) query.session(session);
    return query.lean();
  }

  async count(filters: any = {}): Promise<number> {
    return Transaction.countDocuments(filters);
  }

  async delete(transactionId: Types.ObjectId, session?: ClientSession): Promise<ITransaction | null> {
    return Transaction.findByIdAndDelete(transactionId, { session }).lean();
  }
}
