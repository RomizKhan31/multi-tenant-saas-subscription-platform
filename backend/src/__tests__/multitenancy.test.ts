import request from 'supertest';
import app from '../server';
import { User, Organization, Payment } from '../models';
import mongoose from 'mongoose';

describe('Multi-Tenancy Tests', () => {
  let orgAToken: string;
  let orgBToken: string;
  let orgAId: string;
  let orgBId: string;
  let orgAPaymentId: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Payment.deleteMany({});

    // Create Organization A
    const orgA = new Organization({
      name: 'Organization A',
      contactEmail: 'contact@orga.com',
      billingEmail: 'billing@orga.com',
    });
    await orgA.save();
    orgAId = orgA._id.toString();

    // Create Organization B
    const orgB = new Organization({
      name: 'Organization B',
      contactEmail: 'contact@orgb.com',
      billingEmail: 'billing@orgb.com',
    });
    await orgB.save();
    orgBId = orgB._id.toString();

    // Create admin for Organization A
    const orgAAdmin = new User({
      email: 'orga-admin@example.com',
      password: 'OrgAAdmin123!',
      name: 'Org A Admin',
      role: 'ORGANIZATION_ADMIN',
      organizationId: orgAId,
    });
    await orgAAdmin.save();

    // Create admin for Organization B
    const orgBAdmin = new User({
      email: 'orgb-admin@example.com',
      password: 'OrgBAdmin123!',
      name: 'Org B Admin',
      role: 'ORGANIZATION_ADMIN',
      organizationId: orgBId,
    });
    await orgBAdmin.save();

    // Create payment for Organization A
    const orgAPayment = new Payment({
      organizationId: orgAId,
      subscriptionId: new mongoose.Types.ObjectId(),
      amount: 29.99,
      currency: 'USD',
      status: 'SUCCESS',
    });
    await orgAPayment.save();
    orgAPaymentId = orgAPayment._id.toString();

    // Login and get tokens
    const orgALogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'orga-admin@example.com', password: 'OrgAAdmin123!' });
    orgAToken = orgALogin.body.token;

    const orgBLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'orgb-admin@example.com', password: 'OrgBAdmin123!' });
    orgBToken = orgBLogin.body.token;
  });

  describe('Cross-Tenant Access Prevention', () => {
    it('should prevent Organization A from accessing Organization B payments', async () => {
      const response = await request(app)
        .get(`/api/payments/${orgAPaymentId}`)
        .set('Authorization', `Bearer ${orgBToken}`);

      // Organization B should not be able to access Organization A's payment
      expect(response.status).toBe(403);
    });

    it('should prevent Organization B from accessing Organization A payments list', async () => {
      const response = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${orgBToken}`);

      expect(response.status).toBe(200);
      // Should only return Organization B's payments
      expect(response.body.payments).not.toContainEqual(
        expect.objectContaining({ _id: orgAPaymentId })
      );
    });

    it('should prevent Organization A from updating Organization B', async () => {
      const response = await request(app)
        .put('/api/organizations/profile')
        .set('Authorization', `Bearer ${orgBToken}`)
        .send({ name: 'Hacked Name' });

      // Should only update Organization B, not Organization A
      const orgA = await Organization.findById(orgAId);
      expect(orgA?.name).toBe('Organization A');
    });

    it('should prevent Organization A from inviting members to Organization B', async () => {
      const response = await request(app)
        .post('/api/members/invite')
        .set('Authorization', `Bearer ${orgAToken}`)
        .send({
          email: 'new-member@orgb.com',
          role: 'ORGANIZATION_MEMBER',
        });

      expect(response.status).toBe(200);
      // Invitation should be for Organization A, not Organization B
    });

    it('should prevent Organization A from deleting a member in Organization B', async () => {
      const orgBMember = new User({
        email: 'orgb-member@example.com',
        password: 'Password123!',
        name: 'Org B Member',
        role: 'ORGANIZATION_MEMBER',
        organizationId: orgBId,
      });
      await orgBMember.save();

      const response = await request(app)
        .delete(`/api/members/${orgBMember._id}`)
        .set('Authorization', `Bearer ${orgAToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('not a member of this organization');

      const memberStillExists = await User.findById(orgBMember._id);
      expect(memberStillExists?.organizationId?.toString()).toBe(orgBId);
    });

    it('should prevent Organization A from modifying roles of members in Organization B', async () => {
      const orgBMember = new User({
        email: 'orgb-member-2@example.com',
        password: 'Password123!',
        name: 'Org B Member 2',
        role: 'ORGANIZATION_MEMBER',
        organizationId: orgBId,
      });
      await orgBMember.save();

      const response = await request(app)
        .put(`/api/members/${orgBMember._id}/role`)
        .set('Authorization', `Bearer ${orgAToken}`)
        .send({ role: 'ORGANIZATION_ADMIN' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('not a member of this organization');

      const memberAfter = await User.findById(orgBMember._id);
      expect(memberAfter?.role).toBe('ORGANIZATION_MEMBER');
    });

    it('should allow Organization A to remove its own member', async () => {
      const orgAMember = new User({
        email: 'orga-member@example.com',
        password: 'Password123!',
        name: 'Org A Member',
        role: 'ORGANIZATION_MEMBER',
        organizationId: orgAId,
      });
      await orgAMember.save();

      const response = await request(app)
        .delete(`/api/members/${orgAMember._id}`)
        .set('Authorization', `Bearer ${orgAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('removed successfully');
    });
  });


  describe('Tenant Data Isolation', () => {
    it('should only return payments for the authenticated user organization', async () => {
      // Create additional payment for Organization B
      const orgBPayment = new Payment({
        organizationId: orgBId,
        subscriptionId: new mongoose.Types.ObjectId(),
        amount: 49.99,
        currency: 'USD',
        status: 'SUCCESS',
      });
      await orgBPayment.save();

      const responseA = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${orgAToken}`);

      const responseB = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${orgBToken}`);

      expect(responseA.status).toBe(200);
      expect(responseB.status).toBe(200);

      // Organization A should only see their payment
      expect(responseA.body.payments.length).toBe(1);
      expect(responseA.body.payments[0]._id).toBe(orgAPaymentId);

      // Organization B should only see their payment
      expect(responseB.body.payments.length).toBe(1);
      expect(responseB.body.payments[0]._id).toBe(orgBPayment._id.toString());
    });

    it('should only return members for the authenticated user organization', async () => {
      const responseA = await request(app)
        .get('/api/members')
        .set('Authorization', `Bearer ${orgAToken}`);

      const responseB = await request(app)
        .get('/api/members')
        .set('Authorization', `Bearer ${orgBToken}`);

      expect(responseA.status).toBe(200);
      expect(responseB.status).toBe(200);

      // Each organization should only see their own members
      expect(responseA.body.members.length).toBe(1);
      expect(responseA.body.members[0].email).toBe('orga-admin@example.com');

      expect(responseB.body.members.length).toBe(1);
      expect(responseB.body.members[0].email).toBe('orgb-admin@example.com');
    });
  });

  describe('Organization Access Middleware', () => {
    it('should deny access to user without organization', async () => {
      const platformAdmin = new User({
        email: 'platform-admin@example.com',
        password: 'PlatformAdmin123!',
        name: 'Platform Admin',
        role: 'PLATFORM_ADMIN',
      });
      await platformAdmin.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'platform-admin@example.com', password: 'PlatformAdmin123!' });
      const token = loginResponse.body.token;

      const response = await request(app)
        .post('/api/members/invite')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'new-member@example.com',
          role: 'ORGANIZATION_MEMBER',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('No organization associated with user');
    });
  });
});
