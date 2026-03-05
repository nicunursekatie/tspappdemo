import { useQuery } from '@tanstack/react-query';

interface ReturningOrganizationData {
  isReturning: boolean;
  isReturningContact: boolean;
  inCatalog: boolean;
  pastEventCount: number;
  collectionCount: number;
  pastDepartments: string[];
  mostRecentEvent?: {
    id: number;
    eventDate: string | null;
    status: string | null;
  };
  mostRecentCollection?: {
    id: number;
    dateCollected: string | null;
  };
  pastContactName?: string;
}

/**
 * Hook to check if an organization is a returning organization
 *
 * This helps the intake team identify organizations that have worked with TSP before,
 * so they can personalize their outreach instead of sending generic first-time emails.
 *
 * Also checks whether the current contact person has been involved in past events,
 * giving the team a two-tier signal:
 * - Returning org + same contact = strong signal, personalize heavily
 * - Returning org + new contact = org has history but treat contact as first-time
 *
 * IMPORTANT: Contact matching requires email OR (name + phone) match to prevent
 * false positives from people with the same name.
 *
 * @param organizationName - The organization name to check
 * @param currentEventId - Optional event ID to exclude from the check (for current request)
 * @param contactEmail - Optional contact email to check for returning contact
 * @param contactName - Optional contact full name to check for returning contact
 * @param contactPhone - Optional contact phone to use as secondary validation with name
 * @param enabled - Whether to enable the query (default: true)
 */
export function useReturningOrganization(
  organizationName: string | undefined | null,
  currentEventId?: number,
  contactEmail?: string | null,
  contactName?: string | null,
  contactPhone?: string | null,
  department?: string | null,
  enabled: boolean = true
) {
  return useQuery<ReturningOrganizationData>({
    queryKey: ['returning-organization', organizationName, currentEventId, contactEmail, contactName, contactPhone, department],
    queryFn: async () => {
      if (!organizationName) {
        return {
          isReturning: false,
          isReturningContact: false,
          inCatalog: false,
          pastEventCount: 0,
          collectionCount: 0,
          pastDepartments: [],
        };
      }

      const params = new URLSearchParams({
        orgName: organizationName,
        ...(currentEventId && { currentEventId: currentEventId.toString() }),
        ...(contactEmail && { contactEmail }),
        ...(contactName && { contactName }),
        ...(contactPhone && { contactPhone }),
        ...(department && { department }),
      });

      const response = await fetch(`/api/event-requests/check-returning-org?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check returning organization');
      }

      return response.json();
    },
    enabled: enabled && !!organizationName,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1,
  });
}
