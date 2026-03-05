/**
 * Object Utilities - Prototype Pollution Protection
 *
 * Provides safe object manipulation functions to prevent prototype pollution attacks.
 * See: BUG_FIXES_IMPLEMENTATION_GUIDE.md - BUG-010
 */

import { logger } from './production-safe-logger';

/**
 * Safely copy properties from source to target, preventing prototype pollution
 *
 * Note: Properties with undefined values are NOT copied. This is intentional to prevent
 * clearing existing values. If you need to explicitly set a property to undefined,
 * assign it directly after calling this function.
 *
 * @param target - Object to copy properties to
 * @param source - Object to copy properties from
 * @param allowedKeys - Whitelist of property names that can be copied
 * @returns The target object with safely copied properties
 *
 * @example
 * const updates = {};
 * safeAssign(updates, req.body, ['title', 'description', 'status']);
 */
export function safeAssign<T extends Record<string, any>>(
  target: T,
  source: Record<string, any>,
  allowedKeys: string[]
): T {
  // Blacklist of dangerous property names that could enable prototype pollution
  const dangerousKeys = [
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__'
  ];

  for (const key of allowedKeys) {
    // Skip dangerous keys even if they're in the allowlist
    if (dangerousKeys.includes(key)) {
      logger.warn('Attempted to copy dangerous property', { key });
      continue;
    }

    // Only copy own properties (not inherited ones)
    // This prevents copying inherited properties from prototypes
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      target[key] = source[key];
    }
  }

  return target;
}

/**
 * Validate that an object doesn't contain prototype pollution attempts
 * Recursively checks all nested objects for dangerous property names
 *
 * @param obj - Object to validate
 * @throws Error if prototype pollution attempt is detected
 *
 * @example
 * try {
 *   validateNoPrototypePollution(req.body);
 *   // Safe to proceed
 * } catch (error) {
 *   return res.status(400).json({ error: 'Invalid request' });
 * }
 */
export function validateNoPrototypePollution(obj: any): void {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  function checkObject(o: any, path: string = ''): void {
    // Only check objects (not primitives)
    if (typeof o !== 'object' || o === null) {
      return;
    }

    // Check all own property names
    for (const key of Object.keys(o)) {
      const fullPath = path ? `${path}.${key}` : key;

      // Detect dangerous property names
      if (dangerousKeys.includes(key)) {
        logger.error('Prototype pollution attempt detected', {
          path: fullPath,
          key
        });
        throw new Error(`Prototype pollution attempt detected: ${fullPath}`);
      }

      // Recursively check nested objects
      if (typeof o[key] === 'object' && o[key] !== null) {
        checkObject(o[key], fullPath);
      }
    }
  }

  checkObject(obj);
}

/**
 * Create a safe copy of an object with only allowed properties
 * Useful for sanitizing user input before database operations
 *
 * @param source - Source object to copy from
 * @param allowedKeys - Whitelist of properties to include
 * @returns New object with only allowed properties
 *
 * @example
 * const sanitized = safeCopy(req.body, ['title', 'description']);
 */
export function safeCopy<T = Record<string, any>>(
  source: Record<string, any>,
  allowedKeys: string[]
): T {
  const result: Record<string, any> = {};
  return safeAssign(result, source, allowedKeys) as T;
}

/**
 * Check if a property name is safe (not a prototype pollution vector)
 *
 * @param key - Property name to check
 * @returns true if safe, false if dangerous
 */
export function isSafePropertyName(key: string): boolean {
  const dangerousKeys = [
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__'
  ];

  return !dangerousKeys.includes(key);
}
