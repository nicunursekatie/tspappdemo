/**
 * Category utility functions for meeting dashboard
 */

/**
 * Get the appropriate icon/emoji for a project category
 */
export const getCategoryIcon = (category: string): string => {
  switch (category) {
    case 'technology':
      return '💻';
    case 'events':
      return '📅';
    case 'grants':
      return '💰';
    case 'outreach':
      return '🤝';
    case 'marketing':
      return '📢';
    case 'operations':
      return '⚙️';
    case 'community':
      return '👥';
    case 'fundraising':
      return '💵';
    case 'event':
      return '🎉';
    default:
      return '📁';
  }
};