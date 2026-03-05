import { useMemo } from 'react';
import { PageBreadcrumbs, BreadcrumbSegment } from './page-breadcrumbs';
import { generateBreadcrumbs } from '@/lib/breadcrumb-utils';

interface DashboardBreadcrumbsProps {
  activeSection: string;
  additionalSegments?: BreadcrumbSegment[];
  className?: string;
}

/**
 * Breadcrumbs component specifically for dashboard sections
 * Automatically generates breadcrumbs based on the active section and navigation config
 */
export function DashboardBreadcrumbs({
  activeSection,
  additionalSegments = [],
  className,
}: DashboardBreadcrumbsProps) {
  const segments = useMemo(() => {
    return generateBreadcrumbs(activeSection, additionalSegments);
  }, [activeSection, additionalSegments]);

  // Don't show breadcrumbs on the main dashboard
  if (activeSection === 'dashboard' && additionalSegments.length === 0) {
    return null;
  }

  return <PageBreadcrumbs segments={segments} className={className} />;
}
