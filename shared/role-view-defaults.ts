import { USER_ROLES } from './auth-utils';

/**
 * Role-based view defaults utility
 *
 * This module provides intelligent default views and filters for different user roles,
 * reducing cognitive load by showing users only what's most relevant to them first.
 */

export interface EventRequestViewDefaults {
  defaultTab: 'new' | 'in_process' | 'scheduled' | 'completed' | 'declined' | 'my_assignments';
  defaultSort: 'event_date_desc' | 'event_date_asc' | 'organization_asc' | 'organization_desc' | 'created_date_desc' | 'created_date_asc';
  defaultConfirmationFilter: 'all' | 'confirmed' | 'requested';
  showAssignedFirst: boolean;
  itemsPerPage: number;
}

export interface ExpenseViewDefaults {
  defaultStatusFilter: 'all' | 'pending' | 'approved' | 'rejected' | 'reimbursed';
  defaultCategoryFilter: 'all' | 'food' | 'supplies' | 'transport' | 'reimbursement' | 'other';
  defaultSort: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
  showOwnFirst: boolean;
}

export interface CollectionViewDefaults {
  defaultSort: 'date_desc' | 'date_asc' | 'host_asc' | 'host_desc' | 'sandwiches_desc' | 'sandwiches_asc';
  defaultDateRange: 'all' | 'today' | 'week' | 'month' | 'custom';
  showOwnFirst: boolean;
  itemsPerPage: number;
}

/**
 * Get default Event Request view settings for a user's role
 */
export function getEventRequestDefaults(role: string, userId?: string): EventRequestViewDefaults {
  switch (role) {
    case USER_ROLES.SUPER_ADMIN:
    case USER_ROLES.ADMIN:
    case USER_ROLES.CORE_TEAM:
      // Admins and core team see scheduled events in spreadsheet view (familiar Google Sheets workflow)
      return {
        defaultTab: 'scheduled',
        defaultSort: 'event_date_asc',
        defaultConfirmationFilter: 'all',
        showAssignedFirst: false,
        itemsPerPage: 25,
      };

    case USER_ROLES.COMMITTEE_MEMBER:
      // Committee members see scheduled events in spreadsheet view (familiar Google Sheets workflow)
      return {
        defaultTab: 'scheduled',
        defaultSort: 'event_date_asc',
        defaultConfirmationFilter: 'all',
        showAssignedFirst: true,
        itemsPerPage: 25,
      };

    case USER_ROLES.HOST:
      // Hosts see their own scheduled events first
      return {
        defaultTab: 'my_assignments',
        defaultSort: 'event_date_asc',
        defaultConfirmationFilter: 'confirmed',
        showAssignedFirst: true,
        itemsPerPage: 10,
      };

    case USER_ROLES.DRIVER:
      // Drivers see their own assignments first, upcoming events prioritized
      return {
        defaultTab: 'my_assignments',
        defaultSort: 'event_date_asc',
        defaultConfirmationFilter: 'confirmed',
        showAssignedFirst: true,
        itemsPerPage: 10,
      };

    case USER_ROLES.VOLUNTEER:
      // Volunteers see their assignments first
      return {
        defaultTab: 'my_assignments',
        defaultSort: 'event_date_asc',
        defaultConfirmationFilter: 'confirmed',
        showAssignedFirst: true,
        itemsPerPage: 10,
      };

    case USER_ROLES.RECIPIENT:
      // Recipients see their own organization's events
      return {
        defaultTab: 'scheduled',
        defaultSort: 'event_date_asc',
        defaultConfirmationFilter: 'confirmed',
        showAssignedFirst: true,
        itemsPerPage: 10,
      };

    case USER_ROLES.VIEWER:
    case USER_ROLES.DEMO_USER:
      // Viewers see scheduled events
      return {
        defaultTab: 'scheduled',
        defaultSort: 'event_date_asc',
        defaultConfirmationFilter: 'all',
        showAssignedFirst: false,
        itemsPerPage: 25,
      };

    default:
      // Default fallback
      return {
        defaultTab: 'scheduled',
        defaultSort: 'event_date_asc',
        defaultConfirmationFilter: 'all',
        showAssignedFirst: false,
        itemsPerPage: 10,
      };
  }
}

/**
 * Get default Expense view settings for a user's role
 */
export function getExpenseDefaults(role: string): ExpenseViewDefaults {
  switch (role) {
    case USER_ROLES.SUPER_ADMIN:
    case USER_ROLES.ADMIN:
      // Admins see all expenses, prioritizing pending ones
      return {
        defaultStatusFilter: 'pending',
        defaultCategoryFilter: 'all',
        defaultSort: 'date_desc',
        showOwnFirst: false,
      };

    case USER_ROLES.COMMITTEE_MEMBER:
      // Committee members (acting as treasurers) see pending expenses and receipts
      return {
        defaultStatusFilter: 'pending',
        defaultCategoryFilter: 'all',
        defaultSort: 'date_desc',
        showOwnFirst: false,
      };

    case USER_ROLES.CORE_TEAM:
      // Core team focuses on pending items that need approval
      return {
        defaultStatusFilter: 'pending',
        defaultCategoryFilter: 'all',
        defaultSort: 'date_desc',
        showOwnFirst: false,
      };

    case USER_ROLES.HOST:
    case USER_ROLES.DRIVER:
    case USER_ROLES.VOLUNTEER:
      // Operational roles see their own expenses first
      return {
        defaultStatusFilter: 'all',
        defaultCategoryFilter: 'all',
        defaultSort: 'date_desc',
        showOwnFirst: true,
      };

    case USER_ROLES.RECIPIENT:
    case USER_ROLES.VIEWER:
    case USER_ROLES.DEMO_USER:
      // Limited access roles see all expenses
      return {
        defaultStatusFilter: 'all',
        defaultCategoryFilter: 'all',
        defaultSort: 'date_desc',
        showOwnFirst: false,
      };

    default:
      return {
        defaultStatusFilter: 'all',
        defaultCategoryFilter: 'all',
        defaultSort: 'date_desc',
        showOwnFirst: false,
      };
  }
}

/**
 * Get default Collection view settings for a user's role
 */
export function getCollectionDefaults(role: string): CollectionViewDefaults {
  switch (role) {
    case USER_ROLES.SUPER_ADMIN:
    case USER_ROLES.ADMIN:
      // Admins see all collections, most recent first
      return {
        defaultSort: 'date_desc',
        defaultDateRange: 'month',
        showOwnFirst: false,
        itemsPerPage: 25,
      };

    case USER_ROLES.COMMITTEE_MEMBER:
    case USER_ROLES.CORE_TEAM:
      // Committee and core team see recent data for oversight
      return {
        defaultSort: 'date_desc',
        defaultDateRange: 'week',
        showOwnFirst: false,
        itemsPerPage: 25,
      };

    case USER_ROLES.HOST:
      // Hosts see their own location's collections
      return {
        defaultSort: 'date_desc',
        defaultDateRange: 'month',
        showOwnFirst: true,
        itemsPerPage: 10,
      };

    case USER_ROLES.DRIVER:
    case USER_ROLES.VOLUNTEER:
      // Drivers and volunteers see their own entries
      return {
        defaultSort: 'date_desc',
        defaultDateRange: 'month',
        showOwnFirst: true,
        itemsPerPage: 10,
      };

    case USER_ROLES.RECIPIENT:
      // Recipients see collections related to them
      return {
        defaultSort: 'date_desc',
        defaultDateRange: 'month',
        showOwnFirst: true,
        itemsPerPage: 10,
      };

    case USER_ROLES.VIEWER:
    case USER_ROLES.DEMO_USER:
      // Viewers see all data for reporting/analysis
      return {
        defaultSort: 'date_desc',
        defaultDateRange: 'month',
        showOwnFirst: false,
        itemsPerPage: 25,
      };

    default:
      return {
        defaultSort: 'date_desc',
        defaultDateRange: 'all',
        showOwnFirst: false,
        itemsPerPage: 10,
      };
  }
}

/**
 * Get user-friendly description of what the role's default view shows
 */
export function getRoleViewDescription(role: string, viewType: 'events' | 'expenses' | 'collections'): string {
  const roleDisplay = role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  switch (viewType) {
    case 'events':
      const eventDefaults = getEventRequestDefaults(role);
      if (eventDefaults.defaultTab === 'my_assignments') {
        return `${roleDisplay}: Showing your assigned events first`;
      } else if (eventDefaults.defaultTab === 'new') {
        return `${roleDisplay}: Showing new requests that need attention`;
      } else if (eventDefaults.defaultTab === 'in_process') {
        return `${roleDisplay}: Showing events currently being processed`;
      } else {
        return `${roleDisplay}: Showing upcoming scheduled events`;
      }

    case 'expenses':
      const expenseDefaults = getExpenseDefaults(role);
      if (expenseDefaults.defaultStatusFilter === 'pending') {
        return `${roleDisplay}: Showing pending expenses that need approval`;
      } else if (expenseDefaults.showOwnFirst) {
        return `${roleDisplay}: Showing your expenses first`;
      } else {
        return `${roleDisplay}: Showing all expenses`;
      }

    case 'collections':
      const collectionDefaults = getCollectionDefaults(role);
      if (collectionDefaults.showOwnFirst) {
        return `${roleDisplay}: Showing your collection entries first`;
      } else {
        return `${roleDisplay}: Showing all collection data`;
      }

    default:
      return `${roleDisplay}: Default view`;
  }
}
