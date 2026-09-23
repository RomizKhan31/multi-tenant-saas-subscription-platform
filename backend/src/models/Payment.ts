import mongoose, { Schema, Model } from 'mongoose';
import { IPayment, PaymentStatus } from '../types';

const PaymentSchema = new Schema<IPayment>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    stripePaymentIntentId: {
      type: String,
      sparse: true,
      index: true,
    },
    stripeCheckoutSessionId: {
      type: String,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
PaymentSchema.index({ organizationId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ stripePaymentIntentId: 1 });

export const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', PaymentSchema);
