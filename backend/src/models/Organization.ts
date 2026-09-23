import mongoose, { Schema, Model } from 'mongoose';
import { IOrganization, OrganizationStatus } from '../types';

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    billingEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(OrganizationStatus),
      default: OrganizationStatus.TRIAL,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ status: 1 });

export const Organization: Model<IOrganization> = mongoose.model<IOrganization>('Organization', OrganizationSchema);
