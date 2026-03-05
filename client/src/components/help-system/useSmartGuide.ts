import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export interface UserContext {
  role: string;
  permissions: string[];
  currentPage: string;
  hasCompletedOnboarding: boolean;
  firstTimeUser: boolean;
  recentActivity: string[];
  strugglingWithFeature?: string;
}

interface UseSmartGuideReturn {
  userContext: UserContext;
  isOnboardingComplete: boolean;
  markOnboardingComplete: () => void;
  trackActivity: (activity: string) => void;
  setStruggleFeature: (feature: string | undefined) => void;
  getPersonalizedTips: () => string[];
}

export function useSmartGuide(): UseSmartGuideReturn {
  const { user } = useAuth();
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [strugglingWithFeature, setStruggleFeature] = useState<
    string | undefined
  >();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  // Load user preferences and activity from localStorage
  useEffect(() => {
    const savedActivity = localStorage.getItem('user-activity-log');
    const savedOnboarding = localStorage.getItem('onboarding-complete');
    const savedStruggles = localStorage.getItem('struggling-feature');

    if (savedActivity) {
      try {
        setRecentActivity(JSON.parse(savedActivity));
      } catch (error) {
        logger.error('Failed to parse activity log:', error);
      }
    }

    if (savedOnboarding === 'true') {
      setIsOnboardingComplete(true);
    }

    if (savedStruggles) {
      setStruggleFeature(savedStruggles);
    }
  }, []);

  const trackActivity = useCallback((activity: string) => {
    setRecentActivity((prev) => {
      const updated = [activity, ...prev.slice(0, 49)]; // Keep last 50 activities
      localStorage.setItem('user-activity-log', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const markOnboardingComplete = useCallback(() => {
    setIsOnboardingComplete(true);
    localStorage.setItem('onboarding-complete', 'true');
  }, []);

  const setStruggleFeatureWrapper = useCallback(
    (feature: string | undefined) => {
      setStruggleFeature(feature);
      if (feature) {
        localStorage.setItem('struggling-feature', feature);
      } else {
        localStorage.removeItem('struggling-feature');
      }
    },
    []
  );

  const getPersonalizedTips = useCallback((): string[] => {
    const tips: string[] = [];

    if (!user || !user.role) return tips;

    // Role-based tips
    if (user.role === 'volunteer' || user.role === 'host') {
      tips.push('Use the collection walkthrough for step-by-step guidance');
      tips.push('Save time with the quick collection form for regular entries');
    }

    if (user.role === 'admin' || user.role === 'core_team') {
      tips.push('Check the analytics dashboard for community impact insights');
      tips.push('Use bulk operations for efficient data management');
    }

    // Activity-based tips
    const collectionActivities = recentActivity.filter((a) =>
      a.includes('collection')
    );
    if (collectionActivities.length > 10) {
      tips.push(
        "You're a collection pro! Try keyboard shortcuts: Ctrl+N for new collection"
      );
    }

    const reportActivities = recentActivity.filter((a) => a.includes('report'));
    if (reportActivities.length > 5) {
      tips.push('Schedule automated reports to save time');
    }

    // Struggle-based tips
    if (strugglingWithFeature === 'collections') {
      tips.push('Try the step-by-step walkthrough instead of the quick form');
      tips.push('Contact support if you need help with collection data');
    }

    if (strugglingWithFeature === 'reports') {
      tips.push('Start with pre-built report templates');
      tips.push('Use date filters to narrow down your data');
    }

    return tips.slice(0, 3); // Return top 3 most relevant tips
  }, [user, recentActivity, strugglingWithFeature]);

  const userContext: UserContext = {
    role: user?.role ?? 'viewer',
    permissions:
      user?.permissions && Array.isArray(user.permissions)
        ? user.permissions
        : [],
    currentPage: window.location.pathname,
    hasCompletedOnboarding: isOnboardingComplete,
    firstTimeUser: !isOnboardingComplete && recentActivity.length < 5,
    recentActivity,
    strugglingWithFeature,
  };

  return {
    userContext,
    isOnboardingComplete,
    markOnboardingComplete,
    trackActivity,
    setStruggleFeature: setStruggleFeatureWrapper,
    getPersonalizedTips,
  };
}
