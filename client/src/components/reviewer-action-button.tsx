import { ReactNode, forwardRef, ButtonHTMLAttributes } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useReviewerOptional } from '@/contexts/reviewer-context';
import { cn } from '@/lib/utils';

interface ReviewerActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // The action description shown in the blocked modal
  actionDescription?: string;
  // Button variant (from shadcn/ui Button)
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  // Button size
  size?: 'default' | 'sm' | 'lg' | 'icon';
  // Children (button content)
  children: ReactNode;
  // Additional class names
  className?: string;
  // The actual onClick handler (only called if not a reviewer)
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // Whether the button should be disabled for non-reviewers too
  disabled?: boolean;
  // Custom tooltip message for reviewers
  reviewerTooltip?: string;
  // If true, show as disabled with tooltip instead of clickable
  showDisabledState?: boolean;
}

/**
 * A button that automatically handles reviewer mode.
 *
 * When a reviewer clicks the button:
 * - If showDisabledState=true: Button appears disabled with a tooltip
 * - If showDisabledState=false: Button is clickable but shows the blocked modal
 *
 * When a non-reviewer clicks:
 * - Normal button behavior
 */
export const ReviewerActionButton = forwardRef<HTMLButtonElement, ReviewerActionButtonProps>(
  ({
    actionDescription = 'This action',
    variant = 'default',
    size = 'default',
    children,
    className,
    onClick,
    disabled = false,
    reviewerTooltip = 'Available to full admins. This demo account is read-only.',
    showDisabledState = true,
    ...props
  }, ref) => {
    const reviewerContext = useReviewerOptional();
    const isReviewer = reviewerContext?.isReviewer ?? false;

    // For reviewers with showDisabledState, render disabled button with tooltip
    if (isReviewer && showDisabledState) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button
                  ref={ref}
                  variant={variant}
                  size={size}
                  className={cn('opacity-60 cursor-not-allowed', className)}
                  disabled
                  {...props}
                >
                  {children}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">{reviewerTooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // For reviewers without showDisabledState, let them click but show modal
    if (isReviewer) {
      return (
        <Button
          ref={ref}
          variant={variant}
          size={size}
          className={className}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            reviewerContext?.showBlockedModal(actionDescription);
          }}
          disabled={disabled}
          {...props}
        >
          {children}
        </Button>
      );
    }

    // For non-reviewers, normal button behavior
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={className}
        onClick={onClick}
        disabled={disabled}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

ReviewerActionButton.displayName = 'ReviewerActionButton';

/**
 * A simple hook to get reviewer-aware click handler.
 * Use this when you can't use ReviewerActionButton directly.
 *
 * @example
 * const { handleClick, isReviewer } = useReviewerAction('Save changes');
 * <button onClick={handleClick(onSave)}>Save</button>
 */
export function useReviewerAction(actionDescription?: string) {
  const reviewerContext = useReviewerOptional();
  const isReviewer = reviewerContext?.isReviewer ?? false;

  const handleClick = <T extends (...args: any[]) => any>(action: T) => {
    return (...args: Parameters<T>): ReturnType<T> | void => {
      if (isReviewer) {
        reviewerContext?.showBlockedModal(actionDescription || 'This action');
        return;
      }
      return action(...args);
    };
  };

  return {
    isReviewer,
    handleClick,
    showBlockedModal: reviewerContext?.showBlockedModal,
  };
}
