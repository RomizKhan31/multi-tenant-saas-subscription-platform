import { UserRepository, PasswordResetTokenRepository, PendingRegistrationRepository, PlanRepository } from '../repositories';
import { generateToken } from '../utils/jwt';
import { IUser } from '../types';
import { Types } from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { stripe } from '../config/stripe';
import { sendEmail } from '../utils/email';
import { WebhookService } from './WebhookService';

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private passwordResetTokenRepository: PasswordResetTokenRepository,
    private pendingRegistrationRepository?: PendingRegistrationRepository,
    private planRepository?: PlanRepository,
    private webhookService?: WebhookService
  ) {}

  setWebhookService(webhookService: WebhookService): void {
    this.webhookService = webhookService;
  }

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

    const { password: _password, ...userWithoutPassword } = user.toObject();

    return { user: userWithoutPassword, token };
  }

  async registerOnboard(data: {
    organizationName: string;
    name: string;
    email: string;
    password: string;
    planId: string;
  }): Promise<{ checkoutUrl: string; sessionId: string }> {
    const email = data.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('An account with this email already exists');
    }

    // Verify plan exists and is active
    if (!this.planRepository) {
      throw new Error('Plan service unavailable');
    }
    const plan = await this.planRepository.findById(new Types.ObjectId(data.planId));
    if (!plan || !plan.isActive) {
      throw new Error('Selected plan is invalid or inactive');
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    if (!this.pendingRegistrationRepository) {
      throw new Error('Registration service unavailable');
    }

    // Create pending registration record
    const pendingReg = await this.pendingRegistrationRepository.create({
      organizationName: data.organizationName.trim(),
      adminName: data.name.trim(),
      email,
      passwordHash,
      planId: plan._id,
      status: 'PENDING',
    });

    // Create Stripe Checkout Session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    let checkoutUrl = '';
    let sessionId = `cs_test_${Date.now()}`;

    if (
      process.env.NODE_ENV === 'test' ||
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes('placeholder')
    ) {
      checkoutUrl = `${frontendUrl}/payment/success?session_id=${sessionId}`;
    } else {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${plan.name} Plan - ${data.organizationName}`,
              },
              unit_amount: Math.round(plan.price * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
        customer_email: email,
        payment_intent_data: {
          receipt_email: email,
        },
        metadata: {
          pendingRegistrationId: pendingReg._id.toString(),
          planId: plan._id.toString(),
          type: 'onboarding',
        },
      });
      sessionId = session.id;
      checkoutUrl = session.url || '';
    }

    await this.pendingRegistrationRepository.update(pendingReg._id, {
      stripeCheckoutSessionId: sessionId,
    });

    return {
      checkoutUrl,
      sessionId,
    };
  }


  async getOnboardStatus(sessionId: string): Promise<{
    status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'NOT_FOUND' | 'FAILED';
    organizationName?: string;
    email?: string;
    planName?: string;
    flow?: 'ONBOARDING' | 'PLAN_CHANGE';
    message?: string;
  }> {
    if (this.webhookService) {
      return this.webhookService.getSessionStatus(sessionId);
    }

    if (!this.pendingRegistrationRepository) {
      return { status: 'NOT_FOUND' };
    }

    const pendingReg = await this.pendingRegistrationRepository.findByStripeCheckoutSessionId(sessionId);
    if (!pendingReg) {
      return { status: 'NOT_FOUND' };
    }

    return {
      status: pendingReg.status === 'COMPLETED' ? 'COMPLETED' : pendingReg.status,
      organizationName: pendingReg.organizationName,
      email: pendingReg.email,
      flow: 'ONBOARDING',
    };
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

    const user = await this.userRepository.update(new Types.ObjectId(userId), profile);
    if (!user) {
      throw new Error('User not found');
    }

    const { password: _password, ...userWithoutPassword } = user;
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

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset your password',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
      `,
    });
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
    const user = await this.userRepository.findAuthById(new Types.ObjectId(userId));
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
