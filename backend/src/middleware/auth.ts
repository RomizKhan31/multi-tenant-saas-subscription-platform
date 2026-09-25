import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { IAuthRequest, UserRole, OrganizationStatus } from '../types';
import { Organization } from '../models/Organization';
import { User } from '../models/User';

export const requireAuth = async (req: IAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      role: UserRole;
      organizationId?: string;
    };

    if (!decoded.userId || !Types.ObjectId.isValid(decoded.userId)) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // A signed JWT is a credential, not the authorization source of truth. Loading
    // the account on each protected request immediately applies role changes,
    // removals from an organization, and account deactivations.
    const user = await User.findById(decoded.userId)
      .select('email role organizationId status')
      .lean();

    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: IAuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireOrganizationAccess = async (req: IAuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!req.user.organizationId) {
    return res.status(403).json({ error: 'No organization associated with user' });
  }

  try {
    const org = await Organization.findById(req.user.organizationId).lean();
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (org.status === OrganizationStatus.SUSPENDED) {
      return res.status(403).json({
        error: 'Your organization has been suspended. Please contact platform support.',
        code: 'ORGANIZATION_SUSPENDED',
      });
    }

    if (org.status === OrganizationStatus.CANCELLED) {
      return res.status(403).json({
        error: 'Your organization has been cancelled.',
        code: 'ORGANIZATION_CANCELLED',
      });
    }

    next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to verify organization status' });
  }
};
