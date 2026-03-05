import { NAV_ITEMS } from '@/nav.config';
import { BreadcrumbSegment } from '@/components/page-breadcrumbs';

// Group labels mapping
const GROUP_LABELS: Record<string, string> = {
  'dashboard': 'Dashboard',
  'collections': 'Collections',
  'communication': 'Communication',
  'operations': 'Operations',
  'event-planning': 'Event Planning',
  'strategic-planning': 'Strategic Planning',
  'analytics': 'Analytics & Reports',
  'documentation': 'Documentation',
  'admin': 'Administration',
  'help': 'Help',
};

/**
 * Generate breadcrumb segments for a given section ID
 * @param sectionId - The active section ID (e.g., 'event-requests', 'analytics')
 * @param additionalSegments - Optional additional segments to append
 * @returns Array of breadcrumb segments
 */
export function generateBreadcrumbs(
  sectionId: string,
  additionalSegments: BreadcrumbSegment[] = []
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];

  // Find the nav item for this section
  const navItem = NAV_ITEMS.find((item) => item.id === sectionId);

  if (!navItem) {
    // If not found, return just the additional segments
    return additionalSegments;
  }

  // Add group label if it exists and isn't 'dashboard'
  if (navItem.group && navItem.group !== 'dashboard') {
    const groupLabel = GROUP_LABELS[navItem.group] || navItem.group;
    segments.push({
      label: groupLabel,
      href: undefined, // Groups are not directly linkable
    });
  }

  // If this is a sub-item, find and add the parent
  if (navItem.isSubItem && navItem.parentId) {
    const parentItem = NAV_ITEMS.find((item) => item.id === navItem.parentId);
    if (parentItem) {
      segments.push({
        label: parentItem.label,
        href: `/dashboard?section=${parentItem.href}`,
      });
    }
  }

  // Add the current section (unless it's the dashboard itself)
  if (sectionId !== 'dashboard') {
    segments.push({
      label: navItem.label,
      href: navItem.isSubItem ? undefined : `/dashboard?section=${navItem.href}`,
    });
  }

  // Add any additional segments
  return [...segments, ...additionalSegments];
}

/**
 * Generate breadcrumbs for a project detail page
 */
export function generateProjectBreadcrumbs(projectId: number, projectName?: string): BreadcrumbSegment[] {
  return [
    { label: 'Strategic Planning' },
    { label: 'Projects', href: '/dashboard?section=projects' },
    { label: projectName || `Project #${projectId}` },
  ];
}

/**
 * Generate breadcrumbs for standalone pages (not in dashboard)
 */
export function generateStandaloneBreadcrumbs(pageName: string, category?: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];

  if (category) {
    segments.push({ label: category });
  }

  segments.push({ label: pageName });

  return segments;
}
