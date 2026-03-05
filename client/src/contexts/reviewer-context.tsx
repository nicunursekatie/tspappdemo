import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isReviewerRole } from '@shared/auth-utils';

interface ReviewerContextValue {
  // Whether the current user is a reviewer (read-only)
  isReviewer: boolean;

  // Show the blocked action modal with a custom message
  showBlockedModal: (actionDescription?: string) => void;

  // Hide the blocked action modal
  hideBlockedModal: () => void;

  // Whether the blocked modal is currently visible
  isModalVisible: boolean;

  // The action that was blocked (for display in modal)
  blockedAction: string | null;

  // Helper to wrap an action - returns a function that either executes the action
  // or shows the blocked modal if user is a reviewer
  wrapAction: <T extends (...args: any[]) => any>(
    action: T,
    actionDescription?: string
  ) => (...args: Parameters<T>) => ReturnType<T> | void;
}

const ReviewerContext = createContext<ReviewerContextValue | null>(null);

export function ReviewerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [blockedAction, setBlockedAction] = useState<string | null>(null);

  const isReviewer = isReviewerRole(user);

  const showBlockedModal = useCallback((actionDescription?: string) => {
    setBlockedAction(actionDescription || 'This action');
    setIsModalVisible(true);
  }, []);

  const hideBlockedModal = useCallback(() => {
    setIsModalVisible(false);
    setBlockedAction(null);
  }, []);

  const wrapAction = useCallback(<T extends (...args: any[]) => any>(
    action: T,
    actionDescription?: string
  ) => {
    return (...args: Parameters<T>): ReturnType<T> | void => {
      if (isReviewer) {
        showBlockedModal(actionDescription);
        return;
      }
      return action(...args);
    };
  }, [isReviewer, showBlockedModal]);

  return (
    <ReviewerContext.Provider value={{
      isReviewer,
      showBlockedModal,
      hideBlockedModal,
      isModalVisible,
      blockedAction,
      wrapAction,
    }}>
      {children}
    </ReviewerContext.Provider>
  );
}

export function useReviewer() {
  const context = useContext(ReviewerContext);
  if (!context) {
    throw new Error('useReviewer must be used within a ReviewerProvider');
  }
  return context;
}

// Optional hook that doesn't throw if used outside provider
// Useful for components that might be used in contexts without the provider
export function useReviewerOptional() {
  return useContext(ReviewerContext);
}
