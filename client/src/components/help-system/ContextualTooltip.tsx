import React, { useState, useEffect, useRef } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  HelpCircle,
  Info,
  Lightbulb,
  Zap,
  Target,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface TooltipContent {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'tip' | 'warning' | 'feature' | 'shortcut';
  priority: 'low' | 'medium' | 'high';
  showOnHover?: boolean;
  showOnFocus?: boolean;
  dismissible?: boolean;
  learnMoreUrl?: string;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'default' | 'outline' | 'ghost';
  }>;
}

interface ContextualTooltipProps {
  content: TooltipContent;
  children: React.ReactNode;
  trigger?: 'hover' | 'click' | 'focus' | 'manual';
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  disabled?: boolean;
  onShow?: () => void;
  onHide?: () => void;
  onDismiss?: () => void;
}

const typeConfig = {
  info: {
    icon: <Info className="w-4 h-4" />,
    bgColor: 'bg-brand-primary-lighter',
    borderColor: 'border-brand-primary-border',
    textColor: 'text-brand-primary-darker',
    iconColor: 'text-brand-primary',
  },
  tip: {
    icon: <Lightbulb className="w-4 h-4" />,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-900',
    iconColor: 'text-yellow-600',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-900',
    iconColor: 'text-orange-600',
  },
  feature: {
    icon: <Target className="w-4 h-4" />,
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-900',
    iconColor: 'text-purple-600',
  },
  shortcut: {
    icon: <Zap className="w-4 h-4" />,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900',
    iconColor: 'text-green-600',
  },
};

const priorityStyles = {
  low: 'opacity-75',
  medium: 'opacity-90',
  high: 'opacity-100 shadow-md',
};

export function ContextualTooltip({
  content,
  children,
  trigger = 'hover',
  placement = 'top',
  className = '',
  disabled = false,
  onShow,
  onHide,
  onDismiss,
}: ContextualTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const config = typeConfig[content.type];

  // Check if this tooltip has been dismissed before
  useEffect(() => {
    if (content.dismissible) {
      const dismissed = localStorage.getItem(`tooltip-dismissed-${content.id}`);
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    }
  }, [content.id, content.dismissible]);

  const handleShow = () => {
    // Check if help system is disabled
    const isHelpDisabled =
      localStorage.getItem('help-system-disabled') === 'true';
    if (disabled || isDismissed || isHelpDisabled) return;
    setIsVisible(true);
    onShow?.();
  };

  const handleHide = () => {
    setIsVisible(false);
    onHide?.();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    if (content.dismissible) {
      localStorage.setItem(`tooltip-dismissed-${content.id}`, 'true');
    }
    onDismiss?.();
  };

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      clearTimeout(timeoutRef.current);
      handleShow();
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      timeoutRef.current = setTimeout(handleHide, 200);
    }
  };

  const handleClick = () => {
    if (trigger === 'click') {
      if (isVisible) {
        handleHide();
      } else {
        handleShow();
      }
    }
  };

  const handleFocus = () => {
    if (trigger === 'focus') {
      handleShow();
    }
  };

  const handleBlur = () => {
    if (trigger === 'focus') {
      timeoutRef.current = setTimeout(handleHide, 100);
    }
  };

  // Don't render if dismissed
  if (isDismissed) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={isVisible} onOpenChange={setIsVisible}>
        <TooltipTrigger asChild>
          <div
            className={`contextual-tooltip-trigger ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side={placement}
          className={`
            max-w-sm p-0 border-0 shadow-lg
            ${priorityStyles[content.priority]}
          `}
          sideOffset={8}
        >
          <div
            className={`
            rounded-lg border p-4 
            ${config.bgColor} 
            ${config.borderColor} 
            ${config.textColor}
          `}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`flex-shrink-0 ${config.iconColor}`}>
                {config.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm">{content.title}</h4>
                  <Badge
                    variant="outline"
                    className={`text-xs ${config.textColor} ${config.borderColor}`}
                  >
                    {content.type}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed">{content.description}</p>
              </div>
            </div>

            {/* Actions */}
            {(content.actions ||
              content.learnMoreUrl ||
              content.dismissible) && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-current border-opacity-20">
                {content.actions?.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant || 'outline'}
                    size="sm"
                    className="text-xs h-7"
                    onClick={action.action}
                  >
                    {action.label}
                  </Button>
                ))}

                {content.learnMoreUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => window.open(content.learnMoreUrl, '_blank')}
                  >
                    Learn More
                  </Button>
                )}

                {content.dismissible && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 ml-auto"
                    onClick={handleDismiss}
                  >
                    Got it
                  </Button>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Convenience wrapper for common use cases
export function InfoTooltip({
  title,
  description,
  children,
  ...props
}: {
  title: string;
  description: string;
  children: React.ReactNode;
} & Partial<ContextualTooltipProps>) {
  const content: TooltipContent = {
    id: `info-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    description,
    type: 'info',
    priority: 'medium',
  };

  return (
    <ContextualTooltip content={content} {...props}>
      {children}
    </ContextualTooltip>
  );
}

export function FeatureTooltip({
  title,
  description,
  children,
  ...props
}: {
  title: string;
  description: string;
  children: React.ReactNode;
} & Partial<ContextualTooltipProps>) {
  const content: TooltipContent = {
    id: `feature-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    description,
    type: 'feature',
    priority: 'high',
    dismissible: true,
  };

  return (
    <ContextualTooltip content={content} {...props}>
      {children}
    </ContextualTooltip>
  );
}

export function TipTooltip({
  title,
  description,
  children,
  ...props
}: {
  title: string;
  description: string;
  children: React.ReactNode;
} & Partial<ContextualTooltipProps>) {
  const content: TooltipContent = {
    id: `tip-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    description,
    type: 'tip',
    priority: 'medium',
    dismissible: true,
  };

  return (
    <ContextualTooltip content={content} {...props}>
      {children}
    </ContextualTooltip>
  );
}
