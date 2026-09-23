import { WebhookEvent } from '../models';
import { IWebhookEvent } from '../types';

export class WebhookEventRepository {
  async findByStripeEventId(stripeEventId: string): Promise<IWebhookEvent | null> {
    return WebhookEvent.findOne({ stripeEventId }).lean();
  }

  async create(eventData: Partial<IWebhookEvent>): Promise<IWebhookEvent> {
    const webhookEvent = new WebhookEvent(eventData);
    return webhookEvent.save();
  }

  async markAsProcessed(stripeEventId: string): Promise<IWebhookEvent | null> {
    return WebhookEvent.findOneAndUpdate(
      { stripeEventId },
      { processed: true, processedAt: new Date() },
      { new: true }
    ).lean();
  }

  async markAsFailed(stripeEventId: string, error: string): Promise<IWebhookEvent | null> {
    return WebhookEvent.findOneAndUpdate(
      { stripeEventId },
      { processed: false, error },
      { new: true }
    ).lean();
  }

  async deleteOldEvents(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await WebhookEvent.deleteMany({ createdAt: { $lt: cutoffDate } });
    return result.deletedCount || 0;
  }
}
