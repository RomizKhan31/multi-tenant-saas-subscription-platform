import { UserRepository } from '../repositories';
import { InvitationRepository } from '../repositories';
import { IUser, UserRole } from '../types';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { sendInvitationEmail } from '../utils/email';

export class MemberService {
  constructor(
    private userRepository: UserRepository,
    private invitationRepository: InvitationRepository
  ) {}

  async inviteMember(
    organizationId: Types.ObjectId,
    email: string,
    role: UserRole.ORGANIZATION_ADMIN | UserRole.ORGANIZATION_MEMBER
  ): Promise<void> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser && existingUser.organizationId?.toString() === organizationId.toString()) {
      throw new Error('User is already a member of this organization');
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

    // Create invitation
    const invitation = await this.invitationRepository.create({
      organizationId,
      email,
      role,
      token,
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
    const invitation = await this.invitationRepository.findByToken(token);
    
    if (!invitation) {
      throw new Error('Invalid invitation');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error('Invitation has already been used');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
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
    const { generateToken } = require('../utils/jwt');
    const authToken = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId?.toString(),
    });

    const { password, ...userWithoutPassword } = user.toObject();

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

    await this.userRepository.update(userId, { organizationId: undefined });
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

  async getOrganizationMembers(organizationId: Types.ObjectId): Promise<IUser[]> {
    return this.userRepository.findByOrganizationId(organizationId);
  }
}
