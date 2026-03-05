import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import {
  FolderKanban,
  SquareCheck,
  Calendar,
  Image,
  Receipt,
  Package,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';

interface MessageContextBadgeProps {
  contextType?: string;
  contextId?: string;
  contextTitle?: string;
  entityName?: string;
  className?: string;
  showIcon?: boolean;
}

export function MessageContextBadge({
  contextType,
  contextId,
  contextTitle,
  entityName,
  className = '',
  showIcon = true,
}: MessageContextBadgeProps) {
  if (!contextType || !contextId) return null;

  // Skip rendering for direct messages
  if (contextType === 'direct') return null;

  const displayName = contextTitle || entityName || 'View Item';

  // Get icon based on context type
  const getIcon = () => {
    switch (contextType) {
      case 'project':
        return <FolderKanban className="w-3 h-3" />;
      case 'task':
        return <SquareCheck className="w-3 h-3" />;
      case 'event':
        return <Calendar className="w-3 h-3" />;
      case 'graphic':
      case 'promotion':
        return <Image className="w-3 h-3" />;
      case 'expense':
        return <Receipt className="w-3 h-3" />;
      case 'collection':
        return <Package className="w-3 h-3" />;
      case 'suggestion':
        return <MessageCircle className="w-3 h-3" />;
      default:
        return <ExternalLink className="w-3 h-3" />;
    }
  };

  // Get display label
  const getLabel = () => {
    switch (contextType) {
      case 'project':
        return 'Project';
      case 'task':
        return 'Task';
      case 'event':
        return 'Event';
      case 'graphic':
      case 'promotion':
        return 'Graphic';
      case 'expense':
        return 'Expense';
      case 'collection':
        return 'Collection';
      case 'suggestion':
        return 'Suggestion';
      default:
        return contextType.charAt(0).toUpperCase() + contextType.slice(1);
    }
  };

  // Get link path
  const getLinkPath = () => {
    switch (contextType) {
      case 'project':
        return `/projects?id=${contextId}`;
      case 'task':
        return `/projects?taskId=${contextId}`;
      case 'event':
        return `/events?id=${contextId}`;
      case 'graphic':
      case 'promotion':
        return `/graphics?id=${contextId}`;
      case 'expense':
        return `/expenses?id=${contextId}`;
      case 'collection':
        return `/collections?id=${contextId}`;
      default:
        return null;
    }
  };

  const linkPath = getLinkPath();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
        {showIcon && getIcon()}
        <Badge variant="outline" className="text-xs">
          {getLabel()}
        </Badge>
        {linkPath ? (
          <Link href={linkPath}>
            <a className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              {displayName}
              <ExternalLink className="w-3 h-3" />
            </a>
          </Link>
        ) : (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {displayName}
          </span>
        )}
      </div>
    </div>
  );
}
