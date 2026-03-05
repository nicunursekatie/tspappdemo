import { useQuery } from '@tanstack/react-query';

/**
 * Shared hook for fetching reference data used across event request components.
 *
 * IMPORTANT: This hook is the single source of truth for reference data.
 * Cards and dialogs should use this hook instead of making their own queries.
 *
 * Uses TanStack Query's caching - multiple components calling this hook
 * will share the same cached data without making duplicate API calls.
 */
export const useEventQueries = () => {
  // Fetch users for resolving user IDs to names without requiring admin permissions
  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['/api/users/basic'],
    staleTime: 5 * 60 * 1000, // 5 minutes - user data rarely changes
  });

  // Fetch users specifically for assignments
  const { data: usersForAssignments = [], isLoading: usersForAssignmentsLoading } = useQuery<any[]>({
    queryKey: ['/api/users/for-assignments'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch drivers, hosts, and volunteers for assignment modal
  const { data: drivers = [], isLoading: driversLoading, error: driversError } = useQuery<any[]>({
    queryKey: ['/api/drivers'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: hosts = [], isLoading: hostsLoading } = useQuery<any[]>({
    queryKey: ['/api/hosts'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: hostsWithContacts = [], isLoading: hostsWithContactsLoading } = useQuery<any[]>({
    queryKey: ['/api/hosts-with-contacts'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: volunteers = [], isLoading: volunteersLoading } = useQuery<any[]>({
    queryKey: ['/api/volunteers'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recipients for sandwich destination dropdown
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery<any[]>({
    queryKey: ['/api/recipients'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch host contacts for event cards and dialogs
  const { data: hostContacts = [], isLoading: hostContactsLoading } = useQuery<Array<{
    id: number;
    displayName: string;
    name: string;
    hostLocationName: string;
    email?: string;
    phone?: string;
  }>>({
    queryKey: ['/api/host-contacts'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch('/api/host-contacts');
      if (!response.ok) throw new Error('Failed to fetch host contacts');
      return response.json();
    },
  });

  return {
    users,
    usersLoading,
    usersForAssignments,
    usersForAssignmentsLoading,
    drivers,
    driversLoading,
    driversError,
    hosts,
    hostsLoading,
    hostsWithContacts,
    hostsWithContactsLoading,
    volunteers,
    volunteersLoading,
    recipients,
    recipientsLoading,
    hostContacts,
    hostContactsLoading,
  };
};
