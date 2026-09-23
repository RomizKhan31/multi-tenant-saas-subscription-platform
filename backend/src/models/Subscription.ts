import mongoose, { Schema, Model } from 'mongoose';
import { ISubscription, SubscriptionStatus } from '../types';

const SubscriptionSchema = new Schema<ISubscription>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.PENDING,
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true,
    },
    stripeCustomerId: {
      type: String,
      sparse: true,
    },
    currentPeriodStart: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups (organizationId and stripeSubscriptionId are indexed in schema)

export const Subscription: Model<ISubscription> = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
