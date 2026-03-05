/**
 * Rate Limiting Configuration
 *
 * Protects against brute force attacks on authentication endpoints.
 * Uses express-rate-limit for simple, in-memory rate limiting.
 *
 * For production with multiple servers, consider using:
 * - rate-limit-redis for shared state
 * - rate-limit-postgresql for database-backed limits
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../utils/production-safe-logger';

/**
 * Rate limiter for login attempts
 *
 * Limits: 20 attempts per 15 minutes per IP (increased for development/testing)
 * After limit: 429 Too Many Requests with retry-after header
 * 
 * Can be disabled by setting DISABLE_LOGIN_RATE_LIMIT=true
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window (increased from 5 for easier testing)
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for login from IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
  skip: (req) => {
    // Skip rate limiting in development or if explicitly disabled
    return process.env.NODE_ENV === 'development' || 
           process.env.DISABLE_LOGIN_RATE_LIMIT === 'true';
  },
});

/**
 * Rate limiter for password reset requests
 *
 * Limits: 3 attempts per hour per IP
 * More restrictive to prevent email enumeration attacks
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many password reset requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for password reset from IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
});

/**
 * Rate limiter for signup
 *
 * Limits: 5 signups per hour per IP
 * Prevents mass account creation
 */
export const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many signup attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for signup from IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
});

/**
 * General API rate limiter
 *
 * Limits: 100 requests per minute per IP
 * Prevents API abuse while allowing normal usage
 */
export const generalApiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
});
