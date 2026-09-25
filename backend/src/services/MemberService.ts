import { UserRepository, InvitationRepository, OrganizationRepository } from '../repositories';
import { IUser, UserRole, OrganizationStatus } from '../types';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { sendInvitationEmail } from '../utils/email';
import { generateToken } from '../utils/jwt';
import { Organization } from '../models/Organization';

export class MemberService {
  constructor(
    private userRepository: UserRepository,
    private invitationRepository: InvitationRepository,
    private organizationRepository?: OrganizationRepository
  ) {}

  private async getOrganization(organizationId: Types.ObjectId) {
    if (this.organizationRepository) {
      return this.organizationRepository.findById(organizationId);
    }
    return Organization.findById(organizationId).lean();
  }

  async inviteMember(
    organizationId: Types.ObjectId,
    email: string,
    role: UserRole.ORGANIZATION_ADMIN | UserRole.ORGANIZATION_MEMBER
  ): Promise<void> {
    // Verify organization is active
    const organization = await this.getOrganization(organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }
    if (organization.status === OrganizationStatus.SUSPENDED) {
      throw new Error('Organization is currently suspended. New invitations are disabled.');
    }
    if (organization.status === OrganizationStatus.CANCELLED) {
      throw new Error('Organization is cancelled. New invitations are disabled.');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser && existingUser.organizationId?.toString() === organizationId.toString()) {
      throw new Error('User is already a member of this organization');
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

    // Create invitation
    const invitation = await this.invitationRepository.create({
      organizationId,
      email,
      role,
      // Like password-reset tokens, invitations are bearer credentials and
      // must not be usable directly from a database dump.
      token: tokenHash,
      expiresAt,
    });

    // Do not report a successful invitation when the recipient was not emailed.
    const sent = await sendInvitationEmail(email, 'Organization', token);
    if (!sent) {
      await this.invitationRepository.delete(invitation._id);
      throw new Error('Invitation email could not be delivered. Verify the Resend sender domain and recipient settings, then try again.');
    }
  }

  async acceptInvitation(token: string, userData: {
    name: string;
    password: string;
  }): Promise<{ user: Omit<IUser, 'password'>; token: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await this.invitationRepository.findByToken(tokenHash);
    
    if (!invitation) {
      throw new Error('Invalid invitation');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error('Invitation has already been used');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }

    // Check organization status - suspended organizations cannot onboard members
    const organization = await this.getOrganization(invitation.organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }
    if (organization.status === OrganizationStatus.SUSPENDED) {
      throw new Error('This organization is currently suspended. New members cannot join a suspended organization.');
    }
    if (organization.status === OrganizationStatus.CANCELLED) {
      throw new Error('This organization has been cancelled.');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(invitation.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create user
    const user = await this.userRepository.create({
      email: invitation.email,
      password: userData.password,
      name: userData.name,
      role: invitation.role,
      organizationId: invitation.organizationId,
    });

    // Update invitation status
    await this.invitationRepository.update(invitation._id, { status: 'ACCEPTED' });

    // Generate auth token
    const authToken = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId?.toString(),
    });

    const { password: _password, ...userWithoutPassword } = user.toObject();

    return { user: userWithoutPassword, token: authToken };
  }

  async removeMember(organizationId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.organizationId?.toString() !== organizationId.toString()) {
      throw new Error('User is not a member of this organization');
    }

    await this.userRepository.update(userId, { organizationId: null as any });
  }

  async changeMemberRole(
    organizationId: Types.ObjectId,
    userId: Types.ObjectId,
    newRole: UserRole
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.organizationId?.toString() !== organizationId.toString()) {
      throw new Error('User is not a member of this organization');
    }

    await this.userRepository.update(userId, { role: newRole });
  }

  async getOrganizationMembers(organizationId: Types.ObjectId): Promise<Omit<IUser, 'password'>[]> {
    const members = await this.userRepository.findByOrganizationId(organizationId);
    return members.map((m: any) => {
      const { password: _password, ...rest } = m;
      return rest;
    });
  }
}
