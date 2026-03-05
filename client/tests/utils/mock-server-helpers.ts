import { Request, Response, NextFunction } from 'express';

/**
 * Helper to create mock Express request object
 */
export const mockRequest = (options: Partial<Request> = {}): Partial<Request> => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    session: undefined,
    user: undefined,
    ...options,
  };
};

/**
 * Helper to create mock Express response object
 */
export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
};

/**
 * Helper to create mock Next function
 */
export const mockNext = (): NextFunction => {
  return jest.fn() as NextFunction;
};

/**
 * Create a mock authenticated session
 */
export const createMockSession = (userId = 1, role = 'volunteer') => ({
  passport: {
    user: userId,
  },
  user: {
    id: userId,
    username: `user${userId}`,
    email: `user${userId}@example.com`,
    role,
  },
});

/**
 * Create a mock admin session
 */
export const createAdminSession = (userId = 999) =>
  createMockSession(userId, 'admin');

/**
 * Helper to create authenticated request
 */
export const mockAuthRequest = (
  userId = 1,
  role = 'volunteer',
  options: Partial<Request> = {}
): Partial<Request> => {
  const session = createMockSession(userId, role);
  return mockRequest({
    session: session as any,
    user: session.user,
    isAuthenticated: () => true,
    ...options,
  });
};

/**
 * Helper to create admin authenticated request
 */
export const mockAdminRequest = (
  userId = 999,
  options: Partial<Request> = {}
): Partial<Request> => {
  return mockAuthRequest(userId, 'admin', options);
};

/**
 * Mock database query result
 */
export const mockDbResult = <T>(data: T | T[], count?: number) => {
  const isArray = Array.isArray(data);
  return {
    rows: isArray ? data : [data],
    rowCount: count ?? (isArray ? data.length : 1),
  };
};

/**
 * Mock database error
 */
export const mockDbError = (message = 'Database error', code = '23505') => {
  const error = new Error(message) as any;
  error.code = code;
  return error;
};
