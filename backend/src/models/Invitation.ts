import mongoose, { Schema, Model } from 'mongoose';
import { IInvitation, UserRole } from '../types';

const InvitationSchema = new Schema<IInvitation>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: [UserRole.ORGANIZATION_ADMIN, UserRole.ORGANIZATION_MEMBER],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
      default: 'PENDING',
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

// Index for faster lookups (organizationId is indexed in schema, token has unique: true, email and expiresAt added)

export const Invitation: Model<IInvitation> = mongoose.model<IInvitation>('Invitation', InvitationSchema);
