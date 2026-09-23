import { Types } from 'mongoose';
import { Request } from 'express';

export enum UserRole {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  ORGANIZATION_ADMIN = 'ORGANIZATION_ADMIN',
  ORGANIZATION_MEMBER = 'ORGANIZATION_MEMBER',
}

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  ROLLED_BACK = 'ROLLED_BACK',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  ROLLED_BACK = 'ROLLED_BACK',
}

export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  organizationId?: Types.ObjectId;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrganization {
  _id: Types.ObjectId;
  name: string;
  contactEmail: string;
  billingEmail: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPlan {
  _id: Types.ObjectId;
  name: string;
  price: number;
  billingInterval: BillingInterval;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscription {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  planId: Types.ObjectId;
  status: SubscriptionStatus;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  expiryReminderSent?: boolean;
  expiryReminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPendingRegistration {
  _id: Types.ObjectId;
  organizationName: string;
  adminName: string;
  email: string;
  passwordHash: string;
  planId: Types.ObjectId;
  stripeCheckoutSessionId?: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransaction {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  paymentId: Types.ObjectId;
  amount: number;
  currency: string;
  status: TransactionStatus;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvitation {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  email: string;
  role: UserRole;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPasswordResetToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IWebhookEvent {
  _id: Types.ObjectId;
  stripeEventId: string;
  eventType: string;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
}

export interface IAuthRequest extends Request {
  user?: {
    userId: Types.ObjectId;
    email: string;
    role: UserRole;
    organizationId?: Types.ObjectId;
  };
  body: any;
  query: any;
  params: any;
}

