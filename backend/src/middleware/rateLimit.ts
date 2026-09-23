import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';

export const createRateLimiter = (windowMs: number, max: number, message: string): RequestHandler => {
  if (process.env.NODE_ENV === 'test') {
    return (_req, _res, next) => next();
  }

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 requests
  'Too many authentication attempts, please try again later'
);

export const generalRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many requests, please try again later'
);

export const invitationRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 requests
  'Too many invitation attempts, please try again later'
);

export const paymentRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  5, // 5 requests
  'Too many payment attempts, please try again later'
);
