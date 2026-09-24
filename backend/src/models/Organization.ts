import mongoose, { Schema, Model } from 'mongoose';
import { IOrganization, OrganizationStatus } from '../types';

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Organization: Model<IOrganization> = mongoose.model<IOrganization>('Organization', OrganizationSchema);
