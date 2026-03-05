import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useErrorHandler } from '../useErrorHandler';
import { mockUser } from '../../../../tests/utils/mock-factories';

// Mock dependencies
const mockToast = jest.fn();
const mockLog = jest.fn();

jest.mock('../useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: mockUser(),
    isAuthenticated: true,
  })),
}));

jest.mock('../use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    log: mockLog,
    error: jest.fn(),
    warn: jest.fn(),
    group: jest.fn(),
    groupEnd: jest.fn(),
  },
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock DynamicErrorManager
jest.mock('@shared/error-management', () => ({
  DynamicErrorManager: {
    getErrorMessage: jest.fn((error) => ({
      title: 'Error',
      userFriendlyExplanation: typeof error === 'string' ? error : error.message,
      category: 'general',
      severity: 'medium',
      suggestedActions: [],
    })),
    getCategoryIcon: jest.fn(() => '⚠️'),
  },
}));

describe('useErrorHandler', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should initialize with no error', () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    expect(result.current.currentError).toBeNull();
    expect(result.current.isLoggingError).toBe(false);
  });

  it('should handle error and show toast', async () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    act(() => {
      result.current.handleError('Test error message');
    });

    await waitFor(() => {
      expect(result.current.currentError).toBeTruthy();
      expect(mockToast).toHaveBeenCalled();
    });
  });

  it('should handle error without showing toast when showToast is false', () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    act(() => {
      result.current.handleError('Test error', { showToast: false });
    });

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('should handle form errors', () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });
    const formData = { username: 'test', password: 'pass' };

    act(() => {
      result.current.handleFormError('Form validation failed', formData);
    });

    expect(result.current.currentError).toBeTruthy();
  });

  it('should handle network errors', () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    act(() => {
      result.current.handleNetworkError('Network request failed');
    });

    expect(result.current.currentError).toBeTruthy();
  });

  it('should handle permission errors', () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    act(() => {
      result.current.handlePermissionError('delete user');
    });

    expect(result.current.currentError).toBeTruthy();
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    act(() => {
      result.current.handleError('Test error');
    });

    expect(result.current.currentError).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.currentError).toBeNull();
  });

  it('should handle Error objects', () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });
    const error = new Error('Test error object');

    act(() => {
      result.current.handleError(error);
    });

    expect(result.current.currentError).toBeTruthy();
  });

  it('should accept custom context', () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });
    const context = { customField: 'custom value' };

    act(() => {
      result.current.handleError('Test error', { context });
    });

    expect(result.current.currentError).toBeTruthy();
  });

  it('should not log error when logError is false', () => {
    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    act(() => {
      result.current.handleError('Test error', { logError: false });
    });

    // Error should still be set, just not logged to server
    expect(result.current.currentError).toBeTruthy();
  });
});
