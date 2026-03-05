/**
 * Status utility functions for meeting dashboard
 */

/**
 * Format status text for display by converting snake_case to Title Case
 */
export const formatStatusText = (status: string): string => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Get status badge properties (variant, className, style) based on status
 */
export const getStatusBadgeProps = (status: string) => {
  switch (status) {
    case 'completed':
      return {
        variant: 'default' as const,
        className: 'bg-teal-100 text-teal-800 border-teal-200',
      };
    case 'in_progress':
      return {
        variant: 'secondary' as const,
        className: 'text-black border-2',
        style: { backgroundColor: '#FBAD3F', borderColor: '#FBAD3F' },
      };
    case 'waiting':
    case 'pending':
      return {
        variant: 'secondary' as const,
        className: 'bg-gray-100 text-gray-800 border-gray-200',
      };
    case 'tabled':
      return {
        variant: 'outline' as const,
        className: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    case 'on_hold':
      return {
        variant: 'outline' as const,
        className: 'bg-red-50 text-red-700 border-red-200',
      };
    default:
      return {
        variant: 'secondary' as const,
        className: 'bg-gray-100 text-gray-800 border-gray-200',
      };
  }
};