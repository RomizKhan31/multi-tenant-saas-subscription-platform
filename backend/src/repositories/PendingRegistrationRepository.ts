import { PendingRegistration } from '../models';
import { IPendingRegistration } from '../types';
import { Types, ClientSession } from 'mongoose';

export class PendingRegistrationRepository {
  async findById(id: Types.ObjectId, session?: ClientSession): Promise<IPendingRegistration | null> {
    const query = PendingRegistration.findById(id);
    if (session) query.session(session);
    return query.lean();
  }

  async findByEmail(email: string, session?: ClientSession): Promise<IPendingRegistration | null> {
    const query = PendingRegistration.findOne({ email: email.toLowerCase().trim() });
    if (session) query.session(session);
    return query.lean();
  }

  async findByStripeCheckoutSessionId(sessionId: string, session?: ClientSession): Promise<IPendingRegistration | null> {
    const query = PendingRegistration.findOne({ stripeCheckoutSessionId: sessionId });
    if (session) query.session(session);
    return query.lean();
  }

  async create(data: Partial<IPendingRegistration>, session?: ClientSession): Promise<IPendingRegistration> {
    const record = new PendingRegistration(data);
    return record.save({ session });
  }

  async update(
    id: Types.ObjectId,
    updateData: Partial<IPendingRegistration>,
    session?: ClientSession
  ): Promise<IPendingRegistration | null> {
    return PendingRegistration.findByIdAndUpdate(id, updateData, { new: true, session }).lean();
  }

  async delete(id: Types.ObjectId, session?: ClientSession): Promise<IPendingRegistration | null> {
    return PendingRegistration.findByIdAndDelete(id, { session }).lean();
  }
}
