import { renderHook, act } from '@testing-library/react';
import { useToast, toast } from '../use-toast';

describe('useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should initialize with empty toasts', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toEqual([]);
  });

  it('should add a toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Test Toast',
        description: 'Test description',
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Test Toast');
    expect(result.current.toasts[0].description).toBe('Test description');
  });

  it('should dismiss a toast by id', () => {
    const { result } = renderHook(() => useToast());

    let toastId: string;
    act(() => {
      const { id } = result.current.toast({
        title: 'Test Toast',
      });
      toastId = id;
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismiss(toastId!);
    });

    expect(result.current.toasts[0].open).toBe(false);
  });

  it('should dismiss all toasts when no id provided', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Toast 1' });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.toasts[0].open).toBe(false);
  });

  it('should remove toast after delay', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Test Toast' });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismiss();
    });

    act(() => {
      jest.advanceTimersByTime(5000); // TOAST_REMOVE_DELAY
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should limit number of toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Toast 1' });
      result.current.toast({ title: 'Toast 2' });
      result.current.toast({ title: 'Toast 3' });
    });

    // TOAST_LIMIT is set to 1
    expect(result.current.toasts).toHaveLength(1);
    // Most recent toast should be shown
    expect(result.current.toasts[0].title).toBe('Toast 3');
  });

  it('should allow updating a toast', () => {
    const { result } = renderHook(() => useToast());

    let updateFn: (props: any) => void;
    act(() => {
      const { update } = result.current.toast({
        title: 'Original Title',
      });
      updateFn = update;
    });

    expect(result.current.toasts[0].title).toBe('Original Title');

    act(() => {
      updateFn!({
        title: 'Updated Title',
        description: 'New description',
      });
    });

    expect(result.current.toasts[0].title).toBe('Updated Title');
    expect(result.current.toasts[0].description).toBe('New description');
  });

  it('should set default duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Test Toast' });
    });

    expect(result.current.toasts[0].duration).toBe(3000);
  });

  it('should accept custom duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Test Toast',
        duration: 10000,
      });
    });

    expect(result.current.toasts[0].duration).toBe(10000);
  });

  it('should handle variant property', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Error Toast',
        variant: 'destructive',
      });
    });

    expect(result.current.toasts[0].variant).toBe('destructive');
  });

  it('should return dismiss function from toast call', () => {
    const { result } = renderHook(() => useToast());

    let dismissFn: () => void;
    act(() => {
      const { dismiss } = result.current.toast({
        title: 'Test Toast',
      });
      dismissFn = dismiss;
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].open).toBe(true);

    act(() => {
      dismissFn!();
    });

    expect(result.current.toasts[0].open).toBe(false);
  });

  it('should work with standalone toast function', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: 'Standalone Toast' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Standalone Toast');
  });
});
