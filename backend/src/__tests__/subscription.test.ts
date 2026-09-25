import request from 'supertest';
import app from '../server';
import { User, Organization, Plan, Subscription } from '../models';
import mongoose from 'mongoose';
import { BillingInterval, UserRole, SubscriptionStatus } from '../types';

describe('Subscription Lifecycle & Upgrade/Downgrade Tests', () => {
  let orgAdminToken: string;
  let starterPlan: any;
  let proPlan: any;
  let enterprisePlan: any;
  let inactivePlan: any;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});

    // Seed test plans
    starterPlan = await Plan.create({
      name: 'Starter Plan',
      price: 29.0,
      billingInterval: BillingInterval.MONTHLY,
      features: ['Up to 5 team members', 'Community support'],
      isActive: true,
    });

    proPlan = await Plan.create({
      name: 'Pro Plan',
      price: 99.0,
      billingInterval: BillingInterval.MONTHLY,
      features: ['Up to 20 team members', 'Priority support'],
      isActive: true,
    });

    enterprisePlan = await Plan.create({
      name: 'Enterprise Plan',
      price: 299.0,
      billingInterval: BillingInterval.YEARLY,
      features: ['Unlimited team members', 'Dedicated SLA'],
      isActive: true,
    });

    inactivePlan = await Plan.create({
      name: 'Legacy Retired Plan',
      price: 19.0,
      billingInterval: BillingInterval.MONTHLY,
      features: ['Legacy tier'],
      isActive: false,
    });

    // Seed organization
    const org = await Organization.create({
      name: 'Acme SaaS Corp',
      contactEmail: 'admin@acmesaas.com',
      billingEmail: 'billing@acmesaas.com',
      status: 'ACTIVE',
    });

    // Seed admin user
    await User.create({
      email: 'admin@acmesaas.com',
      password: 'Password123!',
      name: 'Acme Admin',
      role: UserRole.ORGANIZATION_ADMIN,
      organizationId: org._id,
      status: 'ACTIVE',
    });

    // Seed initial subscription on Starter Plan
    await Subscription.create({
      organizationId: org._id,
      planId: starterPlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@acmesaas.com', password: 'Password123!' });
    orgAdminToken = loginRes.body.token;
  });

  describe('GET /api/subscriptions', () => {
    it('should retrieve current active subscription details', async () => {
      const response = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.planId).toBe(starterPlan._id.toString());
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe('POST /api/subscriptions/upgrade', () => {
    it('should successfully upgrade from Starter to Pro plan', async () => {
      const response = await request(app)
        .post('/api/subscriptions/upgrade')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ planId: proPlan._id.toString() });

      expect(response.status).toBe(200);
      expect(response.body.planId).toBe(proPlan._id.toString());
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.cancelAtPeriodEnd).toBe(false);
      expect(response.body).toHaveProperty('currentPeriodEnd');
    });

    it('should successfully upgrade to a yearly Enterprise plan with extended period end', async () => {
      const response = await request(app)
        .post('/api/subscriptions/upgrade')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ planId: enterprisePlan._id.toString() });

      expect(response.status).toBe(200);
      expect(response.body.planId).toBe(enterprisePlan._id.toString());
      const periodEnd = new Date(response.body.currentPeriodEnd);
      const expectedMin = new Date(Date.now() + 360 * 24 * 60 * 60 * 1000);
      expect(periodEnd.getTime()).toBeGreaterThan(expectedMin.getTime());
    });

    it('should reject upgrade to an inactive/archived plan', async () => {
      const response = await request(app)
        .post('/api/subscriptions/upgrade')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ planId: inactivePlan._id.toString() });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('no longer available');
    });

    it('should reject upgrade if already subscribed to the selected plan', async () => {
      const response = await request(app)
        .post('/api/subscriptions/upgrade')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ planId: starterPlan._id.toString() });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Already subscribed');
    });
  });

  describe('POST /api/subscriptions/downgrade', () => {
    it('should successfully downgrade from Pro to Starter plan', async () => {
      // First upgrade to Pro
      await request(app)
        .post('/api/subscriptions/upgrade')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ planId: proPlan._id.toString() });

      // Then downgrade to Starter
      const response = await request(app)
        .post('/api/subscriptions/downgrade')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ planId: starterPlan._id.toString() });

      expect(response.status).toBe(200);
      expect(response.body.planId).toBe(starterPlan._id.toString());
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.cancelAtPeriodEnd).toBe(false);
    });

    it('should reject downgrade if already subscribed to that plan', async () => {
      const response = await request(app)
        .post('/api/subscriptions/downgrade')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ planId: starterPlan._id.toString() });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Already subscribed');
    });
  });

  describe('POST /api/subscriptions/cancel and /reactivate', () => {
    it('should schedule cancellation at period end and then reactivate', async () => {
      // 1. Cancel at period end
      const cancelRes = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send();

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.cancelAtPeriodEnd).toBe(true);

      // 2. Reactivate subscription
      const reactivateRes = await request(app)
        .post('/api/subscriptions/reactivate')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send();

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.status).toBe('ACTIVE');
      expect(reactivateRes.body.cancelAtPeriodEnd).toBe(false);
    });
  });
});
