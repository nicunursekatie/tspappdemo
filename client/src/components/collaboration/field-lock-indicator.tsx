import { useState, useEffect } from "react";
import { Lock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventFieldLock } from "@shared/schema";

interface FieldLockIndicatorProps {
  lock: EventFieldLock | null;
  className?: string;
  showTimer?: boolean;
}

function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  
  if (diff <= 0) return "Expired";
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function FieldLockIndicator({ 
  lock, 
  className,
  showTimer = true 
}: FieldLockIndicatorProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (!lock || !showTimer) return;

    const updateTimer = () => {
      setTimeRemaining(formatTimeRemaining(new Date(lock.expiresAt)));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [lock, showTimer]);

  if (!lock) {
    return null;
  }

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md",
        "bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800",
        "text-yellow-800 dark:text-yellow-300",
        className
      )}
      data-testid="field-lock-indicator"
    >
      <Lock className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm font-medium">
        Locked by {lock.lockedByName}
      </span>
      {showTimer && timeRemaining && (
        <span 
          className="inline-flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400 ml-1"
          data-testid="lock-timer"
        >
          <Clock className="h-3 w-3" />
          {timeRemaining}
        </span>
      )}
    </div>
  );
}
