import mongoose from 'mongoose';
import { User, Organization } from './models';
import { UserRole } from './types';
import dotenv from 'dotenv';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/multi-tenant-saas');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Organization.deleteMany({});
    console.log('Cleared existing data');

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
