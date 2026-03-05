import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Smartphone, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isMobileDevice } from '@/lib/device-detection';

const MOBILE_PREFERENCE_KEY = 'tsp-mobile-layout-preference';
const PROMPT_DISMISSED_KEY = 'tsp-mobile-prompt-dismissed';

type MobilePreference = 'mobile' | 'desktop' | null;

/**
 * Gets stored mobile preference
 */
function getMobilePreference(): MobilePreference {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(MOBILE_PREFERENCE_KEY);
  return stored as MobilePreference;
}

/**
 * Sets mobile preference
 */
function setMobilePreference(pref: MobilePreference): void {
  if (typeof window === 'undefined') return;
  if (pref) {
    localStorage.setItem(MOBILE_PREFERENCE_KEY, pref);
  } else {
    localStorage.removeItem(MOBILE_PREFERENCE_KEY);
  }
}

/**
 * Checks if prompt was recently dismissed
 */
function wasPromptDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
  if (!dismissed) return false;

  // Check if dismissed within last 24 hours
  const dismissedTime = parseInt(dismissed, 10);
  const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
  return hoursSinceDismissed < 24;
}

/**
 * Marks prompt as dismissed
 */
function dismissPrompt(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
}

/**
 * Mobile layout prompt - DISABLED
 * The mobile-specific layout has been deprecated in favor of the responsive desktop dashboard.
 * This component now returns null to prevent redirection to /m routes.
 */
export function MobileLayoutPrompt() {
  // Clear any existing mobile preference to ensure users stay on desktop layout
  useEffect(() => {
    const preference = getMobilePreference();
    if (preference === 'mobile') {
      // Clear the preference so they don't get redirected
      localStorage.removeItem(MOBILE_PREFERENCE_KEY);
    }
  }, []);

  // Always return null - mobile layout is disabled
  return null;

  /* ORIGINAL CODE DISABLED - kept for reference
  const [location, navigate] = useLocation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Only show on desktop routes (not /m/*)
    if (location.startsWith('/m')) {
      setShowPrompt(false);
      return;
    }

    // Check preference first - if manually set to mobile, redirect regardless of detection
    const preference = getMobilePreference();
    if (preference === 'mobile') {
      navigate('/m');
      return;
    }

    // If preference is desktop, don't show prompt
    if (preference === 'desktop') {
      setShowPrompt(false);
      return;
    }

    // Check if on mobile device (only show prompt if auto-detected as mobile)
    if (!isMobileDevice()) {
      setShowPrompt(false);
      return;
    }

    // Check if recently dismissed
    if (wasPromptDismissed()) {
      setShowPrompt(false);
      return;
    }

    // Show prompt after a short delay (500ms so it appears before other modals)
    const timer = setTimeout(() => {
      setIsAnimating(true);
      setShowPrompt(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [location, navigate]);
  */

  const handleUseMobile = () => {
    setMobilePreference('mobile');
    navigate('/m');
  };

  const handleStayDesktop = () => {
    setMobilePreference('desktop');
    setIsAnimating(false);
    setTimeout(() => setShowPrompt(false), 300);
  };

  const handleDismiss = () => {
    dismissPrompt();
    setIsAnimating(false);
    setTimeout(() => setShowPrompt(false), 300);
  };

  if (!showPrompt) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[100]",
        "transition-transform duration-300 ease-out",
        isAnimating ? "translate-y-0" : "translate-y-full"
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-4 mb-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>

        <div className="p-5">
          {/* Icon and message */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Use mobile layout?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                We have a touch-friendly layout optimized for your device with easier navigation.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleStayDesktop}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl font-medium text-sm",
                "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
                "active:scale-[0.98] transition-transform"
              )}
            >
              Stay on desktop
            </button>
            <button
              onClick={handleUseMobile}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl font-medium text-sm",
                "bg-brand-primary text-white",
                "flex items-center justify-center gap-1",
                "active:scale-[0.98] transition-transform"
              )}
            >
              Use mobile layout
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check/set mobile preference
 */
export function useMobilePreference() {
  const [preference, setPreference] = useState<MobilePreference>(null);

  useEffect(() => {
    setPreference(getMobilePreference());
  }, []);

  const updatePreference = (pref: MobilePreference) => {
    setMobilePreference(pref);
    setPreference(pref);
  };

  const clearPreference = () => {
    localStorage.removeItem(MOBILE_PREFERENCE_KEY);
    localStorage.removeItem(PROMPT_DISMISSED_KEY);
    setPreference(null);
  };

  return {
    preference,
    setPreference: updatePreference,
    clearPreference,
    isMobile: isMobileDevice(),
  };
}

export default MobileLayoutPrompt;
