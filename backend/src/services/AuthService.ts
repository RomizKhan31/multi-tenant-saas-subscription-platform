import { UserRepository } from '../repositories';
import { PasswordResetTokenRepository } from '../repositories';
import { generateToken } from '../utils/jwt';
import { IUser, UserRole } from '../types';
import { Types } from 'mongoose';
import crypto from 'crypto';

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private passwordResetTokenRepository: PasswordResetTokenRepository
  ) {}

  async register(userData: {
    email: string;
    password: string;
    name: string;
    organizationId?: string;
  }): Promise<{ user: Omit<IUser, 'password'>; token: string }> {
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = await this.userRepository.create({
      ...userData,
      organizationId: userData.organizationId ? new Types.ObjectId(userData.organizationId) : undefined,
    });

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId?.toString(),
    });

    const { password, ...userWithoutPassword } = user.toObject();

    return { user: userWithoutPassword, token };
  }

  async login(email: string, password: string): Promise<{ user: Omit<IUser, 'password'>; token: string }> {
    const user = await this.userRepository.findAuthByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    if (user.status === 'INACTIVE') {
      throw new Error('Account is inactive');
    }

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId?.toString(),
    });

    const { password: _, ...userWithoutPassword } = user.toObject();

    return { user: userWithoutPassword, token };
  }

  async updateProfile(userId: string, profile: { name?: string; email?: string }): Promise<Omit<IUser, 'password'>> {
    if (profile.email) {
      const existingUser = await this.userRepository.findByEmail(profile.email);
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new Error('An account with this email already exists');
      }
    }

    const user = await this.userRepository.update(userId as any, profile);
    if (!user) {
      throw new Error('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    // Delete any existing reset tokens for this user
    await this.passwordResetTokenRepository.deleteByUserId(user._id);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    await this.passwordResetTokenRepository.create({
      userId: user._id,
      token: resetToken,
      expiresAt,
    });

    // In a real implementation, send email with reset link
    console.log(`Password reset token for ${email}: ${resetToken}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await this.passwordResetTokenRepository.findByToken(token);
    if (!resetToken) {
      throw new Error('Invalid or expired reset token');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new Error('Reset token has expired');
    }

    await this.userRepository.updatePassword(resetToken.userId, newPassword);

    // Delete the used token
    await this.passwordResetTokenRepository.delete(resetToken._id);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findAuthById(userId as any);
    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    await this.userRepository.updatePassword(user._id, newPassword);
  }
}
