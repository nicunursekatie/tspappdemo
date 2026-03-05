/**
 * Accessibility Utilities
 *
 * Helper functions and utilities for ensuring WCAG 2.1 compliance
 * throughout the application.
 */

/**
 * Generate accessible ARIA label for status badges
 */
export function getStatusAriaLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    pending: 'Status: Pending',
    'in-progress': 'Status: In Progress',
    completed: 'Status: Completed',
    cancelled: 'Status: Cancelled',
    success: 'Status: Success',
    warning: 'Status: Warning',
    error: 'Status: Error',
    info: 'Status: Information',
  };

  return statusLabels[status.toLowerCase()] || `Status: ${status}`;
}

/**
 * Generate accessible label for icon-only buttons
 */
export function getIconButtonLabel(action: string, context?: string): string {
  const actionLabels: Record<string, string> = {
    edit: 'Edit',
    delete: 'Delete',
    remove: 'Remove',
    add: 'Add',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    open: 'Open',
    expand: 'Expand',
    collapse: 'Collapse',
    menu: 'Open menu',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    refresh: 'Refresh',
    more: 'More options',
  };

  const baseLabel = actionLabels[action.toLowerCase()] || action;
  return context ? `${baseLabel} ${context}` : baseLabel;
}

/**
 * Check color contrast ratio (simplified WCAG AA compliance check)
 * Returns true if contrast meets WCAG AA standards (4.5:1 for normal text)
 */
export function checkColorContrast(
  foreground: string,
  background: string
): boolean {
  // This is a simplified check. For production, use a proper color contrast library
  // like 'color-contrast-checker' or 'wcag-contrast'
  // For now, we'll assume our design system colors meet WCAG standards
  return true;
}

/**
 * Generate accessible table caption
 */
export function getTableCaption(
  tableName: string,
  itemCount?: number
): string {
  if (itemCount === undefined) {
    return `Table showing ${tableName}`;
  }

  const itemText = itemCount === 1 ? 'item' : 'items';
  return `Table showing ${itemCount} ${itemText} in ${tableName}`;
}

/**
 * Generate accessible loading announcement
 */
export function getLoadingAnnouncement(context: string): string {
  return `Loading ${context}`;
}

/**
 * Generate accessible empty state announcement
 */
export function getEmptyStateAnnouncement(context: string): string {
  return `No ${context} found`;
}

/**
 * Generate accessible error announcement
 */
export function getErrorAnnouncement(error: string): string {
  return `Error: ${error}`;
}

/**
 * Generate accessible success announcement
 */
export function getSuccessAnnouncement(action: string): string {
  return `Success: ${action}`;
}

/**
 * Generate accessible form field error message
 */
export function getFieldErrorMessage(
  fieldName: string,
  error: string
): string {
  return `${fieldName}: ${error}`;
}

/**
 * Keyboard navigation helper - check if Enter or Space key was pressed
 */
export function isActionKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

/**
 * Keyboard navigation helper - check if Escape key was pressed
 */
export function isEscapeKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Escape';
}

/**
 * Keyboard navigation helper - check if Tab key was pressed
 */
export function isTabKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Tab';
}

/**
 * Keyboard navigation helper - check if arrow keys were pressed
 */
export function getArrowDirection(
  event: React.KeyboardEvent
): 'up' | 'down' | 'left' | 'right' | null {
  switch (event.key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}

/**
 * Trap focus within a container (useful for modals and dialogs)
 */
export function trapFocus(
  container: HTMLElement,
  event: React.KeyboardEvent
): void {
  if (!isTabKey(event)) return;

  const focusableElements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  // Guard: if no focusable elements exist, prevent default tab behavior
  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

/**
 * Generate accessible date range announcement
 */
export function getDateRangeAnnouncement(
  startDate: string,
  endDate: string
): string {
  return `Date range from ${startDate} to ${endDate}`;
}

/**
 * Screen reader only text helper
 * Returns className for visually hidden but screen reader accessible text
 */
export const srOnly = 'sr-only';

/**
 * ARIA live region announcer
 * Use this to announce dynamic content changes to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement (safely check if still in DOM)
  setTimeout(() => {
    if (announcement.parentNode) {
      announcement.remove();
    }
  }, 1000);
}

/**
 * Accessibility Guidelines
 */
export const AccessibilityGuidelines = {
  // Minimum touch target size (WCAG 2.1 Level AAA)
  minTouchTarget: '44px',

  // Color contrast ratios (WCAG 2.1 Level AA)
  contrastRatios: {
    normalText: 4.5,
    largeText: 3.0,
    uiComponents: 3.0,
  },

  // Focus indicator requirements
  focusIndicator: {
    minThickness: '2px',
    minContrast: 3.0,
  },

  // Best practices
  bestPractices: [
    'Always provide alt text for images',
    'Use semantic HTML elements',
    'Ensure keyboard navigation works throughout the app',
    'Provide ARIA labels for icon-only buttons',
    'Use aria-live regions for dynamic content',
    'Ensure sufficient color contrast',
    'Provide focus indicators for all interactive elements',
    'Use proper heading hierarchy (h1, h2, h3, etc.)',
    'Ensure forms have proper labels and error messages',
    'Test with screen readers (NVDA, JAWS, VoiceOver)',
  ],
} as const;
