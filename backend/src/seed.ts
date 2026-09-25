import mongoose from 'mongoose';
import { User, Organization, Plan, Subscription } from './models';
import { UserRole, BillingInterval, SubscriptionStatus } from './types';
import dotenv from 'dotenv';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/multi-tenant-saas');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    console.log('Cleared existing data');

    // Create default plans: Starter and Premium (with unlimited member limit)
    const starterPlan = await Plan.create({
      name: 'Starter Plan',
      price: 29.0,
      billingInterval: BillingInterval.MONTHLY,
      features: ['Up to 5 team members', 'Basic analytics', 'Standard support'],
      isActive: true,
    });

    const premiumPlan = await Plan.create({
      name: 'Premium Plan',
      price: 99.0,
      billingInterval: BillingInterval.MONTHLY,
      features: ['Unlimited team members', 'Advanced telemetry', '24/7 priority support', 'Unlimited seat quota'],
      isActive: true,
    });

    const enterprisePlan = await Plan.create({
      name: 'Enterprise Plan',
      price: 299.0,
      billingInterval: BillingInterval.YEARLY,
      features: ['Unlimited team members', 'Dedicated account manager', 'Custom integrations', '99.9% uptime SLA'],
      isActive: true,
    });
    console.log('✓ Created Plans: Starter Plan, Premium Plan (Unlimited Members), Enterprise Plan');

    // Create Platform Admin
    const platformAdmin = new User({
      email: 'platform-admin@example.com',
      password: 'PlatformAdmin123!',
      name: 'Platform Admin',
      role: UserRole.PLATFORM_ADMIN,
    });
    await platformAdmin.save();
    console.log('✓ Created Platform Admin: platform-admin@example.com / PlatformAdmin123!');

    // Create Organization
    const organization = new Organization({
      name: 'Test Organization',
      contactEmail: 'contact@testorg.com',
      billingEmail: 'billing@testorg.com',
      status: 'ACTIVE',
    });
    await organization.save();
    console.log('✓ Created Organization: Test Organization');

    // Create active subscription for the organization on Premium Plan
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 30);
    await Subscription.create({
      organizationId: organization._id,
      planId: premiumPlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });
    console.log('✓ Created Active Subscription: Premium Plan (Unlimited Member Limit)');

    // Create Organization Admin
    const orgAdmin = new User({
      email: 'org-admin@example.com',
      password: 'OrgAdmin123!',
      name: 'Organization Admin',
      role: UserRole.ORGANIZATION_ADMIN,
      organizationId: organization._id,
    });
    await orgAdmin.save();
    console.log('✓ Created Organization Admin: org-admin@example.com / OrgAdmin123!');

    // Create Organization Member
    const orgMember = new User({
      email: 'org-member@example.com',
      password: 'OrgMember123!',
      name: 'Organization Member',
      role: UserRole.ORGANIZATION_MEMBER,
      organizationId: organization._id,
    });
    await orgMember.save();
    console.log('✓ Created Organization Member: org-member@example.com / OrgMember123!');

    console.log('\n=== Test Credentials ===');
    console.log('Platform Admin:');
    console.log('  Email: platform-admin@example.com');
    console.log('  Password: PlatformAdmin123!');
    console.log('\nOrganization Admin:');
    console.log('  Email: org-admin@example.com');
    console.log('  Password: OrgAdmin123!');
    console.log('\nOrganization Member:');
    console.log('  Email: org-member@example.com');
    console.log('  Password: OrgMember123!');
    console.log('\n========================\n');

    await mongoose.connection.close();
    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
