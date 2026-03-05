import { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ButtonTooltipProps {
  explanation?: string; // preferred prop
  text?: string;        // alias for backward compatibility
  tooltip?: string;     // alias for backward compatibility
  children?: ReactNode;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ButtonTooltip({
  explanation,
  text,
  tooltip,
  children,
  showIcon = true,
  size = 'sm',
}: ButtonTooltipProps) {
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (children) {
    // Wrap existing button with tooltip
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              {children}
              {showIcon && (
                <HelpCircle
                  className={`${iconSizes[size]} text-gray-400 hover:text-gray-600 transition-colors cursor-help`}
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm p-3 text-sm bg-gray-900 text-white border-gray-700">
            <p>{explanation ?? text ?? tooltip ?? ''}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Just return the help icon with tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle
            className={`${iconSizes[size]} text-gray-400 hover:text-gray-600 transition-colors cursor-help`}
          />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-3 text-sm bg-gray-900 text-white border-gray-700">
          <p>{explanation ?? text ?? tooltip ?? ''}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
