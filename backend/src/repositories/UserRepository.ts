import { User } from '../models';
import { UserDocument } from '../models/User';
import { IUser } from '../types';
import { Types } from 'mongoose';

export class UserRepository {
  async findById(userId: Types.ObjectId): Promise<IUser | null> {
    return User.findById(userId).lean();
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email }).lean();
  }

  // Authentication requires the hydrated document because comparePassword is a model method.
  async findAuthByEmail(email: string): Promise<UserDocument | null> {
    return User.findOne({ email: email.toLowerCase().trim() });
  }

  async findAuthById(userId: Types.ObjectId): Promise<UserDocument | null> {
    return User.findById(userId);
  }

  async create(userData: Partial<IUser>): Promise<UserDocument> {
    const user = new User(userData);
    return user.save();
  }

  async update(userId: Types.ObjectId, updateData: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(userId, updateData, { new: true }).lean();
  }

  async updatePassword(userId: Types.ObjectId, password: string): Promise<void> {
    const user = await this.findAuthById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    user.password = password;
    await user.save();
  }

  async findByOrganizationId(organizationId: Types.ObjectId): Promise<IUser[]> {
    return User.find({ organizationId }).lean();
  }

  async delete(userId: Types.ObjectId): Promise<IUser | null> {
    return User.findByIdAndDelete(userId).lean();
  }
}
