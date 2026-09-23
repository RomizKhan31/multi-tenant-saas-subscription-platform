import mongoose, { Schema, Model } from 'mongoose';
import { IWebhookEvent } from '../types';

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    stripeEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    processed: {
      type: Boolean,
      default: false,
    },
    processedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
WebhookEventSchema.index({ stripeEventId: 1 });
WebhookEventSchema.index({ processed: 1 });

export const WebhookEvent: Model<IWebhookEvent> = mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
