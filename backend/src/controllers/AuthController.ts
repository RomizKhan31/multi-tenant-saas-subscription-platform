import { Request, Response } from 'express';
import { AuthService } from '../services';
import { z } from 'zod';
import { IAuthRequest } from '../types';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationId: z.string().optional(),
});

const registerOnboardSchema = z.preprocess(
  (data: any) => {
    if (data && typeof data === 'object') {
      const resolvedName = data.name || data.adminName;
      return {
        ...data,
        name: resolvedName,
      };
    }
    return data;
  },
  z.object({
    organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
    name: z.string({ required_error: 'Admin name must be at least 2 characters' }).min(2, 'Admin name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    planId: z.string().min(1, 'Please select a subscription plan'),
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
}).refine((data) => data.name || data.email, { message: 'Provide a name or email to update' });

export class AuthController {
  constructor(private authService: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await this.authService.register(validatedData);
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0]?.message || 'Validation error', details: error.errors });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };

  registerOnboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = registerOnboardSchema.parse(req.body);
      const result = await this.authService.registerOnboard(validatedData);
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0]?.message || 'Validation error', details: error.errors });
      } else if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };

  getOnboardStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.query.sessionId as string;
      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }
      const status = await this.authService.getOnboardStatus(sessionId);
      res.status(200).json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await this.authService.login(validatedData.email, validatedData.password);
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(401).json({ error: error.message });
      }
    }
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body);
      await this.authService.forgotPassword(validatedData.email);
      res.status(200).json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = resetPasswordSchema.parse(req.body);
      await this.authService.resetPassword(validatedData.token, validatedData.newPassword);
      res.status(200).json({ message: 'Password reset successful' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = changePasswordSchema.parse(req.body);
      const userId = (req as any).user.userId;
      await this.authService.changePassword(userId, validatedData.currentPassword, validatedData.newPassword);
      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };

  updateProfile = async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      const validatedData = updateProfileSchema.parse(req.body);
      const user = await this.authService.updateProfile(req.user!.userId.toString(), validatedData);
      res.status(200).json({ user });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };
}
