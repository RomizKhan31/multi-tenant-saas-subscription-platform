import mongoose, { Schema, Model } from 'mongoose';
import { IPlan, BillingInterval } from '../types';

const PlanSchema = new Schema<IPlan>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    billingInterval: {
      type: String,
      enum: Object.values(BillingInterval),
      required: true,
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
PlanSchema.index({ name: 1 });
PlanSchema.index({ isActive: 1 });

export const Plan: Model<IPlan> = mongoose.model<IPlan>('Plan', PlanSchema);
