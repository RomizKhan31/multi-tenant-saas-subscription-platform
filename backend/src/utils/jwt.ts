import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRole } from '../types';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-jwt-secret-that-is-at-least-32-characters-long';
    }
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return secret;
};

const getJwtExpiresIn = (): SignOptions['expiresIn'] => {
  return (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
};

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, getJwtSecret()) as JWTPayload;
};
