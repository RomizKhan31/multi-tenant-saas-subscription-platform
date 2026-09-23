import mongoose, { Schema, Model } from 'mongoose';
import { ITransaction, TransactionStatus } from '../types';

const TransactionSchema = new Schema<ITransaction>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
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
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups (organizationId is indexed in schema, createdAt and status added)

export const Transaction: Model<ITransaction> = mongoose.model<ITransaction>('Transaction', TransactionSchema);
