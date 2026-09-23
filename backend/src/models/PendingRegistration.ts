import mongoose, { Schema, Model } from 'mongoose';
import { IPendingRegistration } from '../types';

const PendingRegistrationSchema = new Schema<IPendingRegistration>(
  {
    organizationName: {
      type: String,
      required: true,
      trim: true,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    stripeCheckoutSessionId: {
      type: String,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PendingRegistration: Model<IPendingRegistration> =
  mongoose.model<IPendingRegistration>('PendingRegistration', PendingRegistrationSchema);
