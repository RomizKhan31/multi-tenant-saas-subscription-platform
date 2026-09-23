import mongoose, { Schema, Model } from 'mongoose';
import { IPasswordResetToken } from '../types';

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups (userId is indexed in schema, token has unique: true, expiresAt added)

export const PasswordResetToken: Model<IPasswordResetToken> = mongoose.model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema);
