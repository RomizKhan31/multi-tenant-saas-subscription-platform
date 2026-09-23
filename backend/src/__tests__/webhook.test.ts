import request from 'supertest';
import app from '../server';
import {
  WebhookEvent,
  Organization,
  User,
  Subscription,
  Payment,
  Transaction,
  Plan,
  PendingRegistration,
} from '../models';
import mongoose from 'mongoose';
import crypto from 'crypto';
import {
  OrganizationStatus,
  SubscriptionStatus,
  PaymentStatus,
  TransactionStatus,
  BillingInterval,
  UserRole,
} from '../types';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

function createSignedHeader(payload: string, secret: string = WEBHOOK_SECRET): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('Webhook Tests', () => {
  let testPlan: any;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await WebhookEvent.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});
    await Subscription.deleteMany({});
    await Payment.deleteMany({});
    await Transaction.deleteMany({});
    await Plan.deleteMany({});
    await PendingRegistration.deleteMany({});

    testPlan = await Plan.create({
      name: 'Starter Plan',
      price: 29.99,
      billingInterval: BillingInterval.MONTHLY,
      features: ['Up to 5 team members', 'Basic analytics'],
      isActive: true,
    });
  });

  describe('Stripe Webhook Signature Verification', () => {
    it('should reject webhook without signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send({ id: 'evt_test_no_sig', type: 'payment_intent.succeeded' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing Stripe signature');
    });

    it('should reject webhook with invalid signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid-signature')
        .send({ id: 'evt_test_bad_sig', type: 'payment_intent.succeeded' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid webhook signature');
    });

    it('should accept webhook with valid signature', async () => {
      const payload = JSON.stringify({
        id: 'evt_valid_sig_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_valid', amount: 2999 } },
      });
      const signature = createSignedHeader(payload);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);

      const recordedEvent = await WebhookEvent.findOne({ stripeEventId: 'evt_valid_sig_1' });
      expect(recordedEvent).not.toBeNull();
      expect(recordedEvent?.processed).toBe(true);
    });
  });

  describe('Duplicate Webhook Idempotency', () => {
    it('should safely ignore duplicate webhook events and not duplicate records', async () => {
      // Create existing organization in TRIAL state
      const org = await Organization.create({
        name: 'Idempotency Test Org',
        contactEmail: 'admin@idempotent.com',
        billingEmail: 'billing@idempotent.com',
        status: OrganizationStatus.TRIAL,
      });

      const adminUser = await User.create({
        name: 'Idempotent Admin',
        email: 'admin@idempotent.com',
        password: 'HashedPassword123!',
        role: UserRole.ORGANIZATION_ADMIN,
        organizationId: org._id,
        status: 'ACTIVE',
      });

      const checkoutSessionId = 'cs_test_duplicate_123';
      const eventId = 'evt_duplicate_test_123';

      const payload = JSON.stringify({
        id: eventId,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: checkoutSessionId,
            payment_intent: 'pi_test_idempotent_123',
            customer: 'cus_test_123',
            subscription: 'sub_stripe_123',
            amount_total: 2999,
            currency: 'usd',
            metadata: {
              organizationId: org._id.toString(),
              planId: testPlan._id.toString(),
            },
          },
        },
      });

      const signature = createSignedHeader(payload);

      // Send the webhook the FIRST time
      const firstResponse = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(firstResponse.status).toBe(200);

      // Verify records created
      const orgAfterFirst = await Organization.findById(org._id);
      expect(orgAfterFirst?.status).toBe(OrganizationStatus.ACTIVE);

      const paymentsCountFirst = await Payment.countDocuments({ organizationId: org._id });
      expect(paymentsCountFirst).toBe(1);

      const subscriptionsCountFirst = await Subscription.countDocuments({ organizationId: org._id });
      expect(subscriptionsCountFirst).toBe(1);

      const transactionsCountFirst = await Transaction.countDocuments({ organizationId: org._id });
      expect(transactionsCountFirst).toBe(1);

      // Send the EXACT SAME webhook the SECOND time
      const secondResponse = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(secondResponse.status).toBe(200);

      // VERIFY: NO DUPLICATE RECORDS
      const paymentsCountSecond = await Payment.countDocuments({ organizationId: org._id });
      expect(paymentsCountSecond).toBe(1); // STILL 1!

      const subscriptionsCountSecond = await Subscription.countDocuments({ organizationId: org._id });
      expect(subscriptionsCountSecond).toBe(1); // STILL 1!

      const transactionsCountSecond = await Transaction.countDocuments({ organizationId: org._id });
      expect(transactionsCountSecond).toBe(1); // STILL 1!

      const orgsCountSecond = await Organization.countDocuments({ _id: org._id });
      expect(orgsCountSecond).toBe(1); // STILL 1!
    });
  });

  describe('Database Transaction Rollback on Failure', () => {
    it('should roll back all changes if a failure occurs during payment confirmation', async () => {
      // Create organization in TRIAL state
      const org = await Organization.create({
        name: 'Rollback Test Org',
        contactEmail: 'admin@rollback.com',
        billingEmail: 'billing@rollback.com',
        status: OrganizationStatus.TRIAL,
      });

      // Spy on Transaction.prototype.save to simulate an unexpected database failure
      const saveSpy = jest
        .spyOn(Transaction.prototype, 'save')
        .mockRejectedValueOnce(new Error('Simulated Database Failure during Transaction save'));

      const payload = JSON.stringify({
        id: 'evt_rollback_test_999',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_rollback_999',
            payment_intent: 'pi_rollback_999',
            amount_total: 2999,
            currency: 'usd',
            metadata: {
              organizationId: org._id.toString(),
              planId: testPlan._id.toString(),
            },
          },
        },
      });

      const signature = createSignedHeader(payload);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(400);

      // Verify atomic rollback:
      // 1. Organization status should NOT be ACTIVE (remains TRIAL)
      const orgAfterRollback = await Organization.findById(org._id);
      expect(orgAfterRollback?.status).toBe(OrganizationStatus.TRIAL);

      // 2. Subscription should NOT have been created
      const subsCount = await Subscription.countDocuments({ organizationId: org._id });
      expect(subsCount).toBe(0);

      // 3. Payment should NOT have been created
      const paymentsCount = await Payment.countDocuments({ organizationId: org._id });
      expect(paymentsCount).toBe(0);

      // 4. Transaction should NOT have been created
      const transactionsCount = await Transaction.countDocuments({ organizationId: org._id });
      expect(transactionsCount).toBe(0);

      saveSpy.mockRestore();
    });
  });

  describe('Paid Onboarding Flow via Webhook', () => {
    it('should create and activate organization, user, subscription, and payments from pending registration', async () => {
      // 1. Candidate signs up and creates pending registration
      const pendingReg = await PendingRegistration.create({
        organizationName: 'Acme SaaS Corp',
        adminName: 'Alice Onboarder',
        email: 'alice@acmesaas.com',
        passwordHash: 'hashed_bcrypt_secret_123',
        planId: testPlan._id,
        stripeCheckoutSessionId: 'cs_onboard_alice_123',
        status: 'PENDING',
      });

      // 2. Stripe completes payment and fires checkout.session.completed
      const payload = JSON.stringify({
        id: 'evt_onboard_complete_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_onboard_alice_123',
            payment_intent: 'pi_onboard_123',
            customer: 'cus_onboard_123',
            subscription: 'sub_onboard_123',
            amount_total: 2999,
            currency: 'usd',
            metadata: {
              pendingRegistrationId: pendingReg._id.toString(),
              planId: testPlan._id.toString(),
              type: 'onboarding',
            },
          },
        },
      });

      const signature = createSignedHeader(payload);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);

      // 3. Verify Organization was created and is ACTIVE
      const createdOrg = await Organization.findOne({ contactEmail: 'alice@acmesaas.com' });
      expect(createdOrg).not.toBeNull();
      expect(createdOrg?.name).toBe('Acme SaaS Corp');
      expect(createdOrg?.status).toBe(OrganizationStatus.ACTIVE);

      // 4. Verify Admin User was created and is ACTIVE
      const createdUser = await User.findOne({ email: 'alice@acmesaas.com' });
      expect(createdUser).not.toBeNull();
      expect(createdUser?.role).toBe(UserRole.ORGANIZATION_ADMIN);
      expect(createdUser?.status).toBe('ACTIVE');
      expect(createdUser?.organizationId?.toString()).toBe(createdOrg?._id.toString());

      // 5. Verify Subscription was created with status ACTIVE
      const createdSub = await Subscription.findOne({ organizationId: createdOrg?._id });
      expect(createdSub).not.toBeNull();
      expect(createdSub?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(createdSub?.planId.toString()).toBe(testPlan._id.toString());

      // 6. Verify Payment was created with status SUCCESS
      const createdPayment = await Payment.findOne({ organizationId: createdOrg?._id });
      expect(createdPayment).not.toBeNull();
      expect(createdPayment?.status).toBe(PaymentStatus.SUCCESS);
      expect(createdPayment?.amount).toBe(29.99);

      // 7. Verify Transaction was created with status SUCCESS
      const createdTx = await Transaction.findOne({ organizationId: createdOrg?._id });
      expect(createdTx).not.toBeNull();
      expect(createdTx?.status).toBe(TransactionStatus.SUCCESS);

      // 8. Verify PendingRegistration is marked COMPLETED
      const updatedPending = await PendingRegistration.findById(pendingReg._id);
      expect(updatedPending?.status).toBe('COMPLETED');
    });

    it('should mark pending registration as EXPIRED when checkout session expires', async () => {
      const pendingReg = await PendingRegistration.create({
        organizationName: 'Abandoned Corp',
        adminName: 'Bob Abandoner',
        email: 'bob@abandoned.com',
        passwordHash: 'hashed_password',
        planId: testPlan._id,
        stripeCheckoutSessionId: 'cs_expired_bob_123',
        status: 'PENDING',
      });

      const payload = JSON.stringify({
        id: 'evt_session_expired_bob',
        type: 'checkout.session.expired',
        data: {
          object: {
            id: 'cs_expired_bob_123',
            metadata: {
              pendingRegistrationId: pendingReg._id.toString(),
            },
          },
        },
      });

      const signature = createSignedHeader(payload);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);

      const updatedPending = await PendingRegistration.findById(pendingReg._id);
      expect(updatedPending?.status).toBe('EXPIRED');

      // Verify NO organization or user was created
      const org = await Organization.findOne({ contactEmail: 'bob@abandoned.com' });
      expect(org).toBeNull();
      const user = await User.findOne({ email: 'bob@abandoned.com' });
      expect(user).toBeNull();
    });
  });

  describe('Payment Failure Events', () => {
    it('should update payment status to FAILED on payment_intent.payment_failed', async () => {
      const org = await Organization.create({
        name: 'Failure Test Org',
        contactEmail: 'contact@fail.com',
        billingEmail: 'billing@fail.com',
        status: OrganizationStatus.ACTIVE,
      });

      const payment = await Payment.create({
        organizationId: org._id,
        subscriptionId: new mongoose.Types.ObjectId(),
        amount: 49.99,
        currency: 'usd',
        status: PaymentStatus.PENDING,
        stripePaymentIntentId: 'pi_fail_test_123',
      });

      const payload = JSON.stringify({
        id: 'evt_pi_failed_123',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_fail_test_123',
          },
        },
      });

      const signature = createSignedHeader(payload);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);

      const updatedPayment = await Payment.findById(payment._id);
      expect(updatedPayment?.status).toBe(PaymentStatus.FAILED);
    });
  });
});
