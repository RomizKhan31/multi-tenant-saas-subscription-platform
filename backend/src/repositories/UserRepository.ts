import { User } from '../models';
import { IUser } from '../types';
import { Types } from 'mongoose';

export class UserRepository {
  async findById(userId: Types.ObjectId): Promise<IUser | null> {
    return User.findById(userId).lean();
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email }).lean();
  }

  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return user.save();
  }

  async update(userId: Types.ObjectId, updateData: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(userId, updateData, { new: true }).lean();
  }

  async findByOrganizationId(organizationId: Types.ObjectId): Promise<IUser[]> {
    return User.find({ organizationId }).lean();
  }

  async delete(userId: Types.ObjectId): Promise<IUser | null> {
    return User.findByIdAndDelete(userId).lean();
  }
}
