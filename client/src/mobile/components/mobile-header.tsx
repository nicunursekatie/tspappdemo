import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  className?: string;
}

/**
 * Mobile header component with back button and title
 */
export function MobileHeader({
  title = 'Sandwich Project',
  showBack = false,
  onBack,
  rightAction,
  className,
}: MobileHeaderProps) {
  const [, navigate] = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // Use browser history if available, otherwise go to mobile home
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigate('/');
      }
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700",
        "px-4 h-14 flex items-center justify-between",
        "shadow-sm",
        className
      )}
    >
      {/* Left side - back button or spacer */}
      <div className="w-10 flex items-center">
        {showBack && (
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </button>
        )}
      </div>

      {/* Center - title */}
      <h1 className="flex-1 text-center font-semibold text-lg text-slate-900 dark:text-slate-100 truncate px-2">
        {title}
      </h1>

      {/* Right side - action or notifications */}
      <div className="w-10 flex items-center justify-end">
        {rightAction || (
          <button
            className="p-2 -mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        )}
      </div>
    </header>
  );
}
