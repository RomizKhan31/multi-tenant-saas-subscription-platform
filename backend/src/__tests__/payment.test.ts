import request from 'supertest';
import app from '../server';
import { User, Organization, Plan, Payment, Subscription } from '../models';
import mongoose from 'mongoose';
import { BillingInterval, UserRole, PaymentStatus, SubscriptionStatus } from '../types';

describe('Payment & Invoice Tests', () => {
  let orgAdminToken: string;
  let otherOrgToken: string;
  let orgAId: string;
  let orgBId: string;
  let testPlan: any;
  let testPayment: any;

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
    await Payment.deleteMany({});
    await Subscription.deleteMany({});

    testPlan = await Plan.create({
      name: 'Pro Plan',
      price: 99.0,
      billingInterval: BillingInterval.MONTHLY,
      features: ['Unlimited members', 'Priority support'],
      isActive: true,
    });

    const orgA = await Organization.create({
      name: 'Alpha Corp',
      contactEmail: 'admin@alpha.com',
      billingEmail: 'billing@alpha.com',
    });
    orgAId = orgA._id.toString();

    const orgB = await Organization.create({
      name: 'Beta Corp',
      contactEmail: 'admin@beta.com',
      billingEmail: 'billing@beta.com',
    });
    orgBId = orgB._id.toString();

    const userA = await User.create({
      email: 'admin@alpha.com',
      password: 'Password123!',
      name: 'Alpha Admin',
      role: UserRole.ORGANIZATION_ADMIN,
      organizationId: orgA._id,
    });

    const userB = await User.create({
      email: 'admin@beta.com',
      password: 'Password123!',
      name: 'Beta Admin',
      role: UserRole.ORGANIZATION_ADMIN,
      organizationId: orgB._id,
    });

    const subA = await Subscription.create({
      organizationId: orgA._id,
      planId: testPlan._id,
      status: SubscriptionStatus.ACTIVE,
    });

    testPayment = await Payment.create({
      organizationId: orgA._id,
      subscriptionId: subA._id,
      amount: 99.0,
      currency: 'usd',
      status: PaymentStatus.SUCCESS,
      stripePaymentIntentId: 'pi_test_invoice_123',
    });

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@alpha.com', password: 'Password123!' });
    orgAdminToken = loginA.body.token;

    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@beta.com', password: 'Password123!' });
    otherOrgToken = loginB.body.token;
  });

  describe('POST /api/auth/register-onboard', () => {
    it('should validate registration input and create pending registration with checkout session', async () => {
      const response = await request(app)
        .post('/api/auth/register-onboard')
        .send({
          organizationName: 'Gamma Systems',
          name: 'Greg Admin',
          email: 'greg@gamma.com',
          password: 'Password123!',
          planId: testPlan._id.toString(),
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('checkoutUrl');

      // Check status endpoint
      const statusRes = await request(app)
        .get(`/api/auth/onboard-status?sessionId=${response.body.sessionId}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.status).toBe('PENDING');
      expect(statusRes.body.organizationName).toBe('Gamma Systems');
    });

    it('should reject registration if email is already taken', async () => {
      const response = await request(app)
        .post('/api/auth/register-onboard')
        .send({
          organizationName: 'Alpha Duplicate',
          name: 'Imposter',
          email: 'admin@alpha.com',
          password: 'Password123!',
          planId: testPlan._id.toString(),
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('Downloadable Invoice Endpoint', () => {
    it('should allow organization admin to access invoice for own payment', async () => {
      const response = await request(app)
        .get(`/api/payments/${testPayment._id}/invoice`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('invoiceNumber');
      expect(response.body.invoiceNumber).toContain('INV-');
      expect(response.body.amount).toBe(99.0);
      expect(response.body.currency).toBe('USD');
      expect(response.body.planName).toBe('Pro Plan');
    });

    it('should reject access to another organization invoice (Cross-tenant isolation)', async () => {
      const response = await request(app)
        .get(`/api/payments/${testPayment._id}/invoice`)
        .set('Authorization', `Bearer ${otherOrgToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Unauthorized');
    });
  });
});
