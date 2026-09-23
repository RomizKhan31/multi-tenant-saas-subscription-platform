import { PasswordResetToken } from '../models';
import { IPasswordResetToken } from '../types';
import { Types } from 'mongoose';

export class PasswordResetTokenRepository {
  async findById(tokenId: Types.ObjectId): Promise<IPasswordResetToken | null> {
    return PasswordResetToken.findById(tokenId).lean();
  }

  async findByToken(token: string): Promise<IPasswordResetToken | null> {
    return PasswordResetToken.findOne({ token }).lean();
  }

  async findByUserId(userId: Types.ObjectId): Promise<IPasswordResetToken | null> {
    return PasswordResetToken.findOne({ userId }).lean();
  }

  async create(tokenData: Partial<IPasswordResetToken>): Promise<IPasswordResetToken> {
    const resetToken = new PasswordResetToken(tokenData);
    return resetToken.save();
  }

  async delete(tokenId: Types.ObjectId): Promise<IPasswordResetToken | null> {
    return PasswordResetToken.findByIdAndDelete(tokenId).lean();
  }

  async deleteByUserId(userId: Types.ObjectId): Promise<number> {
    const result = await PasswordResetToken.deleteMany({ userId });
    return result.deletedCount || 0;
  }

  async deleteExpired(): Promise<number> {
    const result = await PasswordResetToken.deleteMany({ expiresAt: { $lt: new Date() } });
    return result.deletedCount || 0;
  }
}
