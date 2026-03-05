import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from './button';
import {
  useOnboarding,
  OnboardingStep,
  onboardingContent,
} from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

interface OnboardingTooltipProps {
  step: OnboardingStep;
  children: React.ReactNode;
  /** Position of the tooltip relative to the trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Only show when this condition is true (e.g., when badge count > 0) */
  showWhen?: boolean;
  /** Delay before showing the tooltip (ms) */
  delay?: number;
  /** Custom class for the wrapper */
  className?: string;
  /** Called when user dismisses or completes the step */
  onComplete?: () => void;
  /** Whether clicking the child element should auto-complete the step */
  completeOnChildClick?: boolean;
}

export function OnboardingTooltip({
  step,
  children,
  position = 'right',
  showWhen = true,
  delay = 500,
  className,
  onComplete,
  completeOnChildClick = true,
}: OnboardingTooltipProps) {
  const { shouldShowStep, completeStep } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const content = onboardingContent[step];

  // Calculate tooltip position based on trigger element
  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const tooltipWidth = 256; // w-64 = 16rem = 256px
    const tooltipHeight = 140; // approximate height
    const gap = 8; // spacing from trigger

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case 'right':
      default:
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
    }
    // Keep tooltip within viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10;

    // Horizontal bounds
    if (left < padding) left = padding;
    if (left + tooltipWidth > viewportWidth - padding) {
      left = viewportWidth - tooltipWidth - padding;
    }

    // Vertical bounds
    if (top < padding) top = padding;
    if (top + tooltipHeight > viewportHeight - padding) {
      top = viewportHeight - tooltipHeight - padding;
    }
    setTooltipPosition({ top, left });
  }, [position]);

  // Show tooltip after delay if step hasn't been completed
  useEffect(() => {
    if (!shouldShowStep(step) || !showWhen) {
      setIsVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
      // Trigger animation after a small delay
      setTimeout(() => setHasAnimatedIn(true), 50);
    }, delay);

    return () => clearTimeout(timer);
  }, [step, shouldShowStep, showWhen, delay, updatePosition]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isVisible) return;

    const handleUpdate = () => updatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible, updatePosition]);

  const handleDismiss = () => {
    setHasAnimatedIn(false);
    setTimeout(() => {
      setIsVisible(false);
      completeStep(step);
      onComplete?.();
    }, 200);
  };

  const handleChildClick = () => {
    if (completeOnChildClick && isVisible) {
      handleDismiss();
    }
  };

  // Arrow position classes (relative to tooltip)
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-primary',
    bottom:
      'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-primary',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-primary',
    right:
      'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-primary',
  };

  const tooltipContent =
    isVisible &&
    createPortal(
      <div
        className={cn(
          'fixed z-[9999] w-64 transition-all duration-200 pointer-events-auto',
          hasAnimatedIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        )}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
        role="tooltip"
        aria-live="polite"
      >
        {/* Tooltip card */}
        <div className="relative bg-primary text-primary-foreground rounded-lg shadow-xl overflow-hidden border border-primary-foreground/20">
          {/* Animated gradient border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary animate-pulse opacity-50" />

          {/* Content */}
          <div className="relative p-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-yellow-300 animate-pulse" />
                <span className="font-semibold text-sm">{content.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
                className="text-primary-foreground/70 hover:text-primary-foreground transition-colors p-0.5 -m-0.5"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Message */}
            <p className="text-xs text-primary-foreground/90 mb-3 leading-relaxed">
              {content.message}
            </p>

            {/* Action button */}
            {content.action && (
              <Button
                size="sm"
                variant="secondary"
                className="w-full h-7 text-xs font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
              >
                {content.action}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div
          className={cn(
            'absolute w-0 h-0 border-[6px]',
            arrowClasses[position]
          )}
        />
      </div>,
      document.body
    );

  return (
    <div
      ref={wrapperRef}
      className={cn('relative inline-flex', className)}
      onClick={handleChildClick}
    >
      {children}
      {tooltipContent}
    </div>
  );
}

// Simpler inline hint that appears next to badges
interface BadgeHintProps {
  step: OnboardingStep;
  showWhen?: boolean;
  className?: string;
}

export function BadgeHint({
  step,
  showWhen = true,
  className,
}: BadgeHintProps) {
  const { shouldShowStep, completeStep } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (shouldShowStep(step) && showWhen) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [step, shouldShowStep, showWhen]);

  if (!isVisible) return null;

  return (
    <button
      onClick={() => {
        completeStep(step);
        setIsVisible(false);
      }}
      className={cn(
        'absolute -right-1 -top-1 flex items-center justify-center',
        'w-4 h-4 rounded-full bg-yellow-400 text-yellow-900',
        'animate-bounce shadow-lg cursor-pointer',
        'hover:bg-yellow-300 transition-colors',
        className
      )}
      aria-label="Click to learn more"
    >
      <span className="text-[10px] font-bold">?</span>
    </button>
  );
}

// Pulsing attention indicator
export function AttentionPulse({
  active = true,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  if (!active) return null;

  return (
    <span
      className={cn('absolute -right-0.5 -top-0.5 flex h-2 w-2', className)}
    >
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
    </span>
  );
}
