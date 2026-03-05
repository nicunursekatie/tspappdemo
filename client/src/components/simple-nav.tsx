import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@shared/unified-auth-utils';
import type { UserForPermissions } from '@shared/types';
import { useMessaging } from '@/hooks/useMessaging';
import { useStreamChatUnread } from '@/hooks/useStreamChatUnread';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { HelpBubble } from '@/components/help-system/HelpBubble';
import { NavItem } from '@/nav.types';
import sandwich_logo from '@assets/LOGOS/sandwich logo.png';
import { logger } from '@/lib/logger';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { SmartSearch } from '@/components/SmartSearch';
import { OnboardingTooltip } from '@/components/ui/onboarding-tooltip';
import { useOnboarding, OnboardingStep } from '@/hooks/useOnboarding';

export default function SimpleNav({
  navigationItems,
  onSectionChange,
  activeSection,
  isCollapsed = false,
}: {
  navigationItems: NavItem[];
  onSectionChange: (section: string) => void;
  activeSection?: string;
  isCollapsed?: boolean;
}) {
  try {
    const { user } = useAuth();
    const [location, setLocation] = useLocation();
    const { unreadCounts, totalUnread } = useMessaging();
    const { totalUnread: streamChatUnread } = useStreamChatUnread();

    // State for collapsible sections
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    // State for expanded parent items (like TSP Network)
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set(['tsp-network', 'collections']));

    // Get Gmail inbox unread count
    const { data: gmailUnreadCount = 0 } = useQuery({
      queryKey: ['/api/emails/unread-count', (user as any)?.id || 'no-user'],
      queryFn: async () => {
        if (!(user as any)?.id) return 0;
        try {
          const response = await apiRequest('GET', '/api/emails/unread-count');
          return typeof response?.count === 'number' ? response.count : 0;
        } catch (error) {
          logger.warn('Gmail unread count fetch failed:', error);
          return 0;
        }
      },
      enabled: !!(user as any)?.id,
      refetchInterval: 2 * 60 * 1000, // 2 minutes (reduced from 30 seconds for cost optimization)
      retry: false,
    });

    // Get event reminders pending count
    const { data: remindersCount = 0 } = useQuery({
      queryKey: ['/api/event-reminders/count', (user as any)?.id || 'no-user'],
      queryFn: async () => {
        if (!(user as any)?.id) return 0;
        try {
          const response = await apiRequest('GET', '/api/event-reminders/count');
          return typeof response?.count === 'number' ? response.count : 0;
        } catch (error) {
          logger.warn('Event reminders count fetch failed:', error);
          return 0;
        }
      },
      enabled: !!(user as any)?.id,
      refetchInterval: 60000,
      retry: false,
    });

    // Filter navigation items based on user permissions and exclude topNav items
    const permissionFilteredItems = navigationItems.filter(item => {
      // Exclude items marked for top nav
      if (item.topNav) {
        return false;
      }
      if (!item.permission) {
        return true;
      }
      // Cast user to UserForPermissions to satisfy type requirements
      const userForPermissions: UserForPermissions | null | undefined = user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: (user.permissions as string[] | number | null | undefined) ?? null,
        isActive: user.isActive,
      } : null;
      return hasPermission(userForPermissions, item.permission);
    });

    // Second pass: hide parent items that have no visible children
    const filteredNavigationItems = permissionFilteredItems.filter(item => {
      // If this item is a sub-item, keep it
      if (item.isSubItem) {
        return true;
      }
      // Check if this item is a parent (has children in the original nav items)
      const hasChildrenInConfig = navigationItems.some(navItem => navItem.parentId === item.id);
      if (!hasChildrenInConfig) {
        // Not a parent, keep it
        return true;
      }
      // This is a parent - check if it has any visible children
      const hasVisibleChildren = permissionFilteredItems.some(navItem => navItem.parentId === item.id);
      return hasVisibleChildren;
    });

    // Toggle section collapse
    const toggleSection = (group: string) => {
      const newCollapsed = new Set(collapsedSections);
      if (newCollapsed.has(group)) {
        newCollapsed.delete(group);
      } else {
        newCollapsed.add(group);
      }
      setCollapsedSections(newCollapsed);
    };

    // Toggle parent item expansion
    const toggleParent = (parentId: string) => {
      const newExpanded = new Set(expandedParents);
      if (newExpanded.has(parentId)) {
        newExpanded.delete(parentId);
      } else {
        newExpanded.add(parentId);
      }
      setExpandedParents(newExpanded);
    };

    const isActive = (href: string | undefined) => {
      // Guard against undefined href
      if (!href) return false;
      // Extract base section from href (remove query params)
      const baseHref = href.split('?')[0];
      
      if (activeSection) {
        if (baseHref === 'dashboard')
          return activeSection === 'dashboard' || activeSection === '';
        return activeSection === baseHref;
      }

      if (baseHref === 'dashboard')
        return location === '/' || location === '/dashboard';
      return location === `/${baseHref}`;
    };

    // Group items for visual separation
    const groupedItems = filteredNavigationItems.reduce((acc, item, index) => {
      const prevItem = filteredNavigationItems[index - 1];
      const showSeparator =
        prevItem && prevItem.group !== item.group && item.group;

      if (showSeparator) {
        acc.push({ type: 'separator', group: item.group });
      }
      acc.push({ type: 'item', ...item });
      return acc;
    }, [] as any[]);

    const getGroupLabel = (group: string) => {
      const labels = {
        'quick-links': 'QUICK LINKS',
        events: 'EVENTS & VOLUNTEERS',
        network: 'NETWORK',
        resources: 'RESOURCES & TOOLS',
        communication: 'COMMUNICATION',
        data: 'DATA & REPORTS',
        settings: 'SETTINGS',
      };
      return labels[group as keyof typeof labels] || group.toUpperCase();
    };

    const getGroupColors = (group: string) => {
      const colorMap: Record<string, { bg: string; hover: string; border: string; gradient: string }> = {
        'quick-links': {
          bg: 'bg-brand-primary',
          hover: 'hover:bg-brand-primary-dark',
          border: 'border-l-brand-orange',
          gradient: 'from-brand-primary to-brand-primary-dark'
        },
        'events': {
          bg: 'bg-[#007E8C]',
          hover: 'hover:bg-[#006270]',
          border: 'border-l-[#FBAD3F]',
          gradient: 'from-[#007E8C] to-[#006270]'
        },
        'network': {
          bg: 'bg-[#47B3CB]',
          hover: 'hover:bg-[#3A9AB5]',
          border: 'border-l-[#007E8C]',
          gradient: 'from-[#47B3CB] to-[#3A9AB5]'
        },
        'communication': {
          bg: 'bg-brand-primary',
          hover: 'hover:bg-brand-primary-dark',
          border: 'border-l-brand-orange',
          gradient: 'from-brand-primary to-brand-primary-dark'
        },
        'resources': {
          bg: 'bg-[#007E8C]',
          hover: 'hover:bg-[#006270]',
          border: 'border-l-[#47B3CB]',
          gradient: 'from-[#007E8C] to-[#006270]'
        },
        'data': {
          bg: 'bg-[#47B3CB]',
          hover: 'hover:bg-[#3A9AB5]',
          border: 'border-l-brand-orange',
          gradient: 'from-[#47B3CB] to-[#3A9AB5]'
        },
        'settings': {
          bg: 'bg-slate-600',
          hover: 'hover:bg-slate-700',
          border: 'border-l-slate-400',
          gradient: 'from-slate-600 to-slate-700'
        }
      };
      return colorMap[group] || colorMap['quick-links'];
    };

    const getBadgeCount = (itemId: string) => {
      switch (itemId) {
        case 'gmail-inbox':
          return gmailUnreadCount;
        case 'inbox-consolidated':
          // Project Threads uses the email system, so use gmail unread count
          return gmailUnreadCount;
        case 'chat':
          // Use Stream Chat unread count for team chat
          return streamChatUnread || 0;
        case 'suggestions':
          return unreadCounts.suggestions || 0;
        case 'kudos':
          return unreadCounts.kudos || 0;
        case 'event-reminders':
          return remindersCount;
        default:
          return 0;
      }
    };

    // Map nav item IDs to onboarding steps
    const getOnboardingStep = (itemId: string): OnboardingStep | null => {
      switch (itemId) {
        case 'gmail-inbox':
          return 'gmail-badge';
        case 'chat':
          return 'team-chat-badge';
        case 'suggestions':
          return 'suggestions-badge';
        case 'event-reminders':
          return 'event-reminders-badge';
        case 'inbox-consolidated':
          return 'project-threads-intro';
        case 'holding-zone':
          return 'holding-zone-intro';
        default:
          return null;
      }
    };

    // Track if we've shown the first badge intro
    const { shouldShowStep, completeStep } = useOnboarding();
    const [hasShownFirstBadge, setHasShownFirstBadge] = useState(false);

    // Find the first item with a badge to show the intro tooltip
    const firstItemWithBadge = filteredNavigationItems.find(item => getBadgeCount(item.id) > 0);
    const showNavBadgeIntro = firstItemWithBadge && shouldShowStep('nav-badge-intro') && !hasShownFirstBadge;

    return (
      <nav className="flex flex-col gap-1.5 p-3" data-tour="navigation">
        {/* AI-Powered Smart Search */}
        {!isCollapsed && (
          <div className="mb-3 px-1">
            <SmartSearch />
          </div>
        )}

        {groupedItems.map((groupItem, index) => {
          if (groupItem.type === 'separator') {
            const isCollapsedSection = collapsedSections.has(groupItem.group);
            const groupColors = getGroupColors(groupItem.group);
            return !isCollapsed ? (
              <div key={`separator-${groupItem.group}-${index}`} className="mt-4 mb-3">
                <button
                  onClick={() => toggleSection(groupItem.group)}
                  className={`w-full rounded-lg px-3 py-2.5 mb-2 shadow-sm ${groupColors.bg} ${groupColors.hover} transition-colors cursor-pointer flex items-center justify-between group`}
                >
                  <div className="font-bold text-white tracking-wide text-[15px] flex-1 text-left">
                    {getGroupLabel(groupItem.group)}
                  </div>
                  {isCollapsedSection ? (
                    <ChevronRight className="w-4 h-4 text-white/80 group-hover:scale-110 transition-transform" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/80 group-hover:scale-110 transition-transform" />
                  )}
                </button>
                <div className={`border-t ${groupColors.bg} opacity-30 mx-2`} />
              </div>
            ) : null;
          }

          const item = groupItem;
          const badgeCount = getBadgeCount(item.id);

          // Debug: log if we encounter an item without href
          if (!item.href) {
            logger.warn('Navigation item missing href:', { id: item.id, label: item.label, type: item.type });
          }

          const active = isActive(item.href);
          const itemColors = getGroupColors(item.group || 'quick-links');

          // Hide items in collapsed sections (unless item is dashboard)
          const isInCollapsedSection = item.group && collapsedSections.has(item.group) && item.group !== 'dashboard';
          if (isInCollapsedSection) {
            return null;
          }

          // Check if this item has children
          const hasChildren = filteredNavigationItems.some(navItem => navItem.parentId === item.id);
          const isExpanded = expandedParents.has(item.id);

          // Hide sub-items if their parent is not expanded
          if (item.isSubItem && item.parentId && !expandedParents.has(item.parentId)) {
            return null;
          }

          return (

            <Button
              key={item.id}
              variant={active ? 'default' : 'ghost'}
              className={`
              w-full ${
                isCollapsed
                  ? 'justify-center px-2'
                  : item.isSubItem
                    ? 'justify-start pl-8 pr-2 sm:pr-3'
                    : 'justify-start px-2 sm:px-3'
              } text-left h-11 touch-manipulation relative ${
                item.isSubItem ? 'text-sm font-normal' : 'text-base font-medium'
              }
              ${
                active
                  ? `bg-gradient-to-r ${itemColors.gradient} hover:shadow-lg text-white shadow-md border-l-4 ${itemColors.border} rounded-lg transition-all duration-200`
                  : item.highlighted
                    ? 'hover:bg-gradient-to-br hover:from-[#FBAD3F]/10 hover:to-[#FBAD3F]/20 text-[#FBAD3F] font-semibold rounded-lg hover:shadow-sm transition-all duration-200'
                    : item.isSubItem
                      ? 'hover:bg-slate-50 text-slate-600 ml-4 mr-1 rounded-md hover:shadow-sm transition-all duration-200'
                      : 'hover:bg-gradient-to-br hover:from-slate-50 hover:to-slate-100 text-slate-700 rounded-lg hover:shadow-sm transition-all duration-200'
              }
            `}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                logger.log('Navigation click:', item.href);

                // If item has children, toggle expansion
                if (hasChildren) {
                  toggleParent(item.id);

                  // If item has navigateAndExpand flag, also navigate (don't return early)
                  if (!item.navigateAndExpand) {
                    return; // Stop here - don't navigate for regular parent items
                  }
                }

                // Handle navigation for items WITHOUT children, or items with navigateAndExpand
                // Guard against missing href
                if (!item.href) {
                  logger.warn('Attempted to navigate to item without href:', item.id);
                  return;
                }

                // Handle externalUrl - open in new tab
                if (item.externalUrl) {
                  logger.log('Opening external URL in new tab:', item.externalUrl);
                  window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
                  return;
                }

                // Handle external items - navigate directly to the URL (for pages outside dashboard)
                if (item.external) {
                  logger.log('External navigation:', item.href);
                  setLocation(item.href);
                  return;
                }

                // Handle hrefs with query parameters
                if (item.href.includes('?')) {
                  const [baseSection, queryString] = item.href.split('?');
                  logger.log('Navigation with query params:', { baseSection, queryString });

                  // Navigate using Wouter's setLocation to keep router in sync
                  // The Dashboard will pick up the section and tab from URL params
                  const newUrl = `/dashboard?section=${baseSection}&${queryString}`;
                  setLocation(newUrl);
                } else {
                  onSectionChange(item.href);
                }

                // Scroll to top of page after navigation
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title={isCollapsed ? item.label : undefined}
              data-nav-id={item.id}
              data-testid={`nav-${item.id}`}
            >
              {item.customIcon ? (
                <img
                  src={sandwich_logo}
                  alt={item.label}
                  className={`h-4 w-4 flex-shrink-0 ${
                    isCollapsed ? '' : 'mr-2 sm:mr-3'
                  } ${item.highlighted && !active ? 'opacity-90' : ''}`}
                />
              ) : (
                <item.icon
                  className={`h-4 w-4 flex-shrink-0 ${
                    isCollapsed ? '' : 'mr-2 sm:mr-3'
                  } ${item.highlighted && !active ? 'text-[#FBAD3F]' : ''}`}

                />
              )}
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.externalUrl && (
                    <ExternalLink className={`h-3 w-3 flex-shrink-0 ml-1 ${active ? 'text-white/70' : 'text-slate-400'}`} />
                  )}
                  {/* One-time discovery tooltip for Toolkit & Apps */}
                  {item.id === 'quick-tools' && shouldShowStep('toolkit-apps-intro') && (
                    <OnboardingTooltip
                      step="toolkit-apps-intro"
                      position="right"
                      showWhen={true}
                      delay={2000}
                      completeOnChildClick={true}
                    >
                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#FBAD3F] text-white text-[9px] font-bold animate-bounce">
                        !
                      </span>
                    </OnboardingTooltip>
                  )}
                  {badgeCount > 0 && (
                    <>
                      {/* Show intro tooltip on first badge user sees */}
                      {showNavBadgeIntro && item.id === firstItemWithBadge?.id ? (
                        <OnboardingTooltip
                          step="nav-badge-intro"
                          position="right"
                          showWhen={true}
                          delay={1500}
                          onComplete={() => {
                            setHasShownFirstBadge(true);
                          }}
                        >
                          <Badge
                            variant="destructive"
                            className="ml-auto h-5 min-w-[20px] text-xs animate-pulse"
                          >
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </Badge>
                        </OnboardingTooltip>
                      ) : (
                        /* After intro is done, show feature-specific tooltips */
                        (() => {
                          const featureStep = getOnboardingStep(item.id);
                          const showFeatureTooltip = featureStep &&
                            !shouldShowStep('nav-badge-intro') &&
                            shouldShowStep(featureStep);

                          if (showFeatureTooltip && featureStep) {
                            return (
                              <OnboardingTooltip
                                step={featureStep}
                                position="right"
                                showWhen={true}
                                delay={2000}
                              >
                                <Badge
                                  variant="destructive"
                                  className="ml-auto h-5 min-w-[20px] text-xs animate-pulse"
                                >
                                  {badgeCount > 99 ? '99+' : badgeCount}
                                </Badge>
                              </OnboardingTooltip>
                            );
                          }

                          return (
                            <Badge
                              variant="destructive"
                              className="ml-auto h-5 min-w-[20px] text-xs"
                            >
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </Badge>
                          );
                        })()
                      )}
                    </>
                  )}
                  {hasChildren && (
                    <div className="ml-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  )}
                </>
              )}
            </Button>
          );
        })}
      </nav>
    );
  } catch (error) {
    logger.error('SimpleNav rendering error:', error);
    return (
      <nav className="flex flex-col gap-1 p-2">
        <div className="text-sm text-red-500">Navigation error</div>
      </nav>
    );
  }
}