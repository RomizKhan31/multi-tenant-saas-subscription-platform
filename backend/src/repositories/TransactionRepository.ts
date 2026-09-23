import { Transaction } from '../models';
import { ITransaction } from '../types';
import { Types, ClientSession } from 'mongoose';

export class TransactionRepository {
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
