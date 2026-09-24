import { User } from '../models';
import { UserDocument } from '../models/User';
import { IUser } from '../types';
import { Types, ClientSession } from 'mongoose';

export class UserRepository {
  async findById(userId: Types.ObjectId, session?: ClientSession): Promise<IUser | null> {
    const query = User.findById(userId).select('-password');
    if (session) query.session(session);
    return query.lean();
  }

  async findByEmail(email: string, session?: ClientSession): Promise<IUser | null> {
    const query = User.findOne({ email: email.toLowerCase().trim() }).select('-password');
    if (session) query.session(session);
    return query.lean();
  }

  // Authentication requires the hydrated document including the password field because comparePassword is a model method.
  async findAuthByEmail(email: string, session?: ClientSession): Promise<UserDocument | null> {
    const query = User.findOne({ email: email.toLowerCase().trim() });
    if (session) query.session(session);
    return query;
  }

  async findAuthById(userId: Types.ObjectId, session?: ClientSession): Promise<UserDocument | null> {
    const query = User.findById(userId);
    if (session) query.session(session);
    return query;
  }

  async create(userData: Partial<IUser>, session?: ClientSession): Promise<UserDocument> {
    const user = new User(userData);
    return user.save({ session });
  }

  async update(userId: Types.ObjectId, updateData: Partial<IUser>, session?: ClientSession): Promise<IUser | null> {
    const updatePayload: Record<string, unknown> = { ...updateData };
    if (updateData.organizationId === null || updateData.organizationId === undefined && 'organizationId' in updateData) {
      delete updatePayload.organizationId;
      return User.findByIdAndUpdate(
        userId,
        { ...updatePayload, $unset: { organizationId: 1 } },
        { new: true, session }
      ).select('-password').lean();
    }

    return User.findByIdAndUpdate(userId, updatePayload, { new: true, session }).select('-password').lean();
  }

  async updatePassword(userId: Types.ObjectId, password: string, session?: ClientSession): Promise<void> {
    const user = await this.findAuthById(userId, session);
    if (!user) {
      throw new Error('User not found');
    }
    user.password = password;
    await user.save({ session });
  }

  async findByOrganizationId(organizationId: Types.ObjectId, session?: ClientSession): Promise<IUser[]> {
    const query = User.find({ organizationId }).select('-password');
    if (session) query.session(session);
    return query.lean();
  }

  async delete(userId: Types.ObjectId, session?: ClientSession): Promise<IUser | null> {
    return User.findByIdAndDelete(userId, { session }).select('-password').lean();
  }
}
