import request from 'supertest';
import app from '../server';
import { User, Organization } from '../models';
import mongoose from 'mongoose';

describe('Authorization Tests', () => {
  let platformAdminToken: string;
  let orgAdminToken: string;
  let orgMemberToken: string;
  let organizationId: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});

    // Create platform admin
    const platformAdmin = new User({
      email: 'platform-admin@example.com',
      password: 'PlatformAdmin123!',
      name: 'Platform Admin',
      role: 'PLATFORM_ADMIN',
    });
    await platformAdmin.save();

    // Create organization
    const organization = new Organization({
      name: 'Test Organization',
      contactEmail: 'contact@testorg.com',
      billingEmail: 'billing@testorg.com',
    });
    await organization.save();
    organizationId = organization._id.toString();

    // Create org admin
    const orgAdmin = new User({
      email: 'org-admin@example.com',
      password: 'OrgAdmin123!',
      name: 'Org Admin',
      role: 'ORGANIZATION_ADMIN',
      organizationId,
    });
    await orgAdmin.save();

    // Create org member
    const orgMember = new User({
      email: 'org-member@example.com',
      password: 'OrgMember123!',
      name: 'Org Member',
      role: 'ORGANIZATION_MEMBER',
      organizationId,
    });
    await orgMember.save();

    // Login and get tokens
    const platformAdminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'platform-admin@example.com', password: 'PlatformAdmin123!' });
    platformAdminToken = platformAdminLogin.body.token;

    const orgAdminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'org-admin@example.com', password: 'OrgAdmin123!' });
    orgAdminToken = orgAdminLogin.body.token;

    const orgMemberLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'org-member@example.com', password: 'OrgMember123!' });
    orgMemberToken = orgMemberLogin.body.token;
  });

  describe('Platform Admin Access', () => {
    it('should allow platform admin to access organizations endpoint', async () => {
      const response = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow platform admin to create plans', async () => {
      const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          name: 'Basic Plan',
          price: 29.99,
          billingInterval: 'MONTHLY',
          features: ['Feature 1', 'Feature 2'],
        });

      expect(response.status).toBe(201);
    });

    it('should allow platform admin to suspend organization', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organizationId}/suspend`)
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Organization Admin Access', () => {
    it('should allow org admin to update organization profile', async () => {
      const response = await request(app)
        .put('/api/organizations/profile')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Updated Organization Name' });

      expect(response.status).toBe(200);
    });

    it('should allow org admin to invite members', async () => {
      const response = await request(app)
        .post('/api/members/invite')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          email: 'new-member@example.com',
          role: 'ORGANIZATION_MEMBER',
        });

      expect(response.status).toBe(200);
    });

    it('should deny org admin access to platform admin endpoints', async () => {
      const response = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Organization Member Access', () => {
    it('should allow org member to view organization members', async () => {
      const response = await request(app)
        .get('/api/members')
        .set('Authorization', `Bearer ${orgMemberToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny org member access to invite members', async () => {
      const response = await request(app)
        .post('/api/members/invite')
        .set('Authorization', `Bearer ${orgMemberToken}`)
        .send({
          email: 'new-member@example.com',
          role: 'ORGANIZATION_MEMBER',
        });

      expect(response.status).toBe(403);
    });

    it('should deny org member access to update organization', async () => {
      const response = await request(app)
        .put('/api/organizations/profile')
        .set('Authorization', `Bearer ${orgMemberToken}`)
        .send({ name: 'Updated Organization Name' });

      expect(response.status).toBe(403);
    });

    it('should deny org member access to platform admin endpoints', async () => {
      const response = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${orgMemberToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should prevent unauthorized role access', async () => {
      const response = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          name: 'Unauthorized Plan',
          price: 9.99,
          billingInterval: 'MONTHLY',
          features: [],
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Suspended Organization Access & Lifecycle', () => {
    it('should prevent suspended organization users from logging in', async () => {
      // Suspend the organization
      await request(app)
        .post(`/api/organizations/${organizationId}/suspend`)
        .set('Authorization', `Bearer ${platformAdminToken}`);

      // Try logging in as org admin
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'org-admin@example.com', password: 'OrgAdmin123!' });

      expect(adminLogin.status).toBe(401);
      expect(adminLogin.body.error).toContain('suspended');

      // Try logging in as org member
      const memberLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'org-member@example.com', password: 'OrgMember123!' });

      expect(memberLogin.status).toBe(401);
      expect(memberLogin.body.error).toContain('suspended');
    });

    it('should deny active tokens from accessing organization resources while suspended', async () => {
      // Suspend the organization
      await request(app)
        .post(`/api/organizations/${organizationId}/suspend`)
        .set('Authorization', `Bearer ${platformAdminToken}`);

      // Org admin tries to view members
      const membersRes = await request(app)
        .get('/api/members')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(membersRes.status).toBe(403);
      expect(membersRes.body.error).toContain('suspended');

      // Org admin tries to update profile
      const updateRes = await request(app)
        .put('/api/organizations/profile')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Blocked Name' });

      expect(updateRes.status).toBe(403);
      expect(updateRes.body.error).toContain('suspended');
    });

    it('should restore full access when platform admin reactivates organization', async () => {
      // 1. Suspend
      await request(app)
        .post(`/api/organizations/${organizationId}/suspend`)
        .set('Authorization', `Bearer ${platformAdminToken}`);

      // 2. Reactivate
      const reactivateRes = await request(app)
        .post(`/api/organizations/${organizationId}/reactivate`)
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.status).toBe('ACTIVE');

      // 3. Org admin can log in again
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'org-admin@example.com', password: 'OrgAdmin123!' });

      expect(adminLogin.status).toBe(200);
      expect(adminLogin.body).toHaveProperty('token');

      // 4. Token can access members again
      const membersRes = await request(app)
        .get('/api/members')
        .set('Authorization', `Bearer ${adminLogin.body.token}`);

      expect(membersRes.status).toBe(200);
    });

    it('should prevent new user registration under a suspended organization', async () => {
      // Suspend
      await request(app)
        .post(`/api/organizations/${organizationId}/suspend`)
        .set('Authorization', `Bearer ${platformAdminToken}`);

      // Register with organizationId
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Suspended Signup',
          email: 'suspended-signup@example.com',
          password: 'TestPassword123!',
          organizationId,
        });

      expect(regRes.status).toBe(400);
      expect(regRes.body.error).toContain('suspended');
    });
  });
});
