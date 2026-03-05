import { Router, Response } from 'express';
import { storage } from '../../storage-wrapper';
import { GroupsCatalogDependencies, AuthenticatedRequest } from '../../types';
import { logger } from '../../utils/production-safe-logger';
import { canonicalizeOrgName, organizationNamesMatch } from '../../utils/organization-canonicalization';

export function createGroupsCatalogRoutes(deps: GroupsCatalogDependencies) {
  const router = Router();

  // Groups Catalog: Complete directory of all organizations (current requests + historical hosts)
  // Query params:
  //   viewMode: 'aggregated' (default) - groups events by org+dept+contact
  //             'individual' - each event request is its own card
  router.get('/', deps.isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const viewMode = (req.query.viewMode as string) || 'aggregated';
      if (viewMode !== 'aggregated' && viewMode !== 'individual') {
        return res.status(400).json({ message: 'Invalid viewMode. Must be "aggregated" or "individual"' });
      }

      // Get all event requests and aggregate by organization + department
      const allEventRequests = await storage.getAllEventRequests();

      // Get all historical host organizations from sandwich collections
      const allCollections = await storage.getAllSandwichCollections();
      
      // Get all users to resolve assignedTo IDs to names
      const allUsers = await storage.getAllUsers();
      const userIdToName = new Map();
      allUsers.forEach(u => {
        const name = u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id;
        userIdToName.set(u.id, name);
      });

      // Get all organizations from database for category information
      const allOrganizations = await storage.getAllOrganizations();
      const organizationCategoryMap = new Map();

      // Prioritize organization-level entries (without department) over department-specific entries
      allOrganizations.forEach(org => {
        const canonicalKey = canonicalizeOrgName(org.name);
        const existing = organizationCategoryMap.get(canonicalKey);

        // If no existing entry, add this one
        if (!existing) {
          organizationCategoryMap.set(canonicalKey, {
            category: org.category,
            schoolClassification: org.schoolClassification,
            isReligious: org.isReligious,
            department: org.department,
          });
        }
        // If existing entry has a department but this one doesn't, replace with org-level entry
        else if (existing.department && !org.department) {
          organizationCategoryMap.set(canonicalKey, {
            category: org.category,
            schoolClassification: org.schoolClassification,
            isReligious: org.isReligious,
            department: org.department,
          });
        }
        // Otherwise keep the existing entry (prefer first match or org-level entry)
      });

      // STEP 1: Build canonical organization name mapping
      // This ensures all name variations (e.g., "Allstate" and "Allstate/Pebble Tossers") map to same canonical name
      const canonicalOrgNameMap = new Map<string, string>(); // Maps original org name -> canonical name
      
      allEventRequests.forEach((request) => {
        const orgName = request.organizationName;
        if (!orgName) return;
        
        const candidateCanonical = canonicalizeOrgName(orgName);
        
        // Check if a matching canonical name already exists
        let matchingCanonical: string | null = null;
        for (const [existingOrgName, existingCanonical] of canonicalOrgNameMap.entries()) {
          if (organizationNamesMatch(candidateCanonical, existingCanonical)) {
            matchingCanonical = existingCanonical;
            break;
          }
        }
        
        // Use existing canonical or create new one
        const finalCanonical = matchingCanonical || candidateCanonical;
        canonicalOrgNameMap.set(orgName, finalCanonical);
      });
      
      // STEP 2: Create a map to aggregate data by organization + department + contact
      const departmentsMap = new Map();

      allEventRequests.forEach((request) => {
        const orgName = request.organizationName;
        const department = request.department || '';
        const contactName =
          request.firstName && request.lastName
            ? `${request.firstName} ${request.lastName}`.trim()
            : request.firstName || request.lastName || request.email || 'Unknown Contact';
        const contactEmail = request.email || '';

        if (!orgName) return;

        // Use the canonical name from our mapping (this groups "Allstate" and "Allstate/Pebble Tossers" together)
        const canonicalOrgName = canonicalOrgNameMap.get(orgName) || canonicalizeOrgName(orgName);

        // Group by organization + department + contact (one card per unique contact)
        // In 'individual' mode, add event ID to key so each event gets its own card
        const departmentKey = viewMode === 'individual'
          ? `${canonicalOrgName}|${department}|${contactEmail}|${request.id}`
          : `${canonicalOrgName}|${department}|${contactEmail}`;

        // Check if this event has co-hosts (partner organizations where primary org is also listed)
        const partnerOrgs = request.partnerOrganizations || [];
        const coHostNames = Array.isArray(partnerOrgs)
          ? partnerOrgs
              .filter((p: any) => p && p.name && p.name.trim() && p.name.trim() !== orgName)
              .map((p: any) => p.name.trim())
          : [];
        const isCoHostedEvent = coHostNames.length > 0;

        // Track contact-level aggregation (one entry per unique contact)
        if (!departmentsMap.has(departmentKey)) {
          departmentsMap.set(departmentKey, {
            organizationName: orgName, // Preserve original display name
            canonicalName: canonicalOrgName, // Store canonical for matching
            department: department,
            contactName: contactName,
            contactEmail: contactEmail,
            contactPhone: request.phone,
            contacts: [{
              name: contactName,
              email: contactEmail,
              phone: request.phone,
            }],
            totalRequests: 0,
            latestStatus: 'new',
            latestRequestDate: request.createdAt || new Date(),
            hasHostedEvent: false,
            totalSandwiches: 0,
            eventDate: null,
            tspContact: null,
            tspContactAssigned: null,
            assignedTo: null,
            assignedToName: null,
            completedEventsFromRequests: 0, // Track completed events from event_requests
            // Co-host tracking
            isCoHostedEvent: isCoHostedEvent,
            coHostNames: isCoHostedEvent ? coHostNames : [],
            // Track the event ID - will be used for single-event edits
            linkedEventId: request.id,
            // Track all event IDs for this aggregated card
            eventIds: [request.id],
          });
        } else {
          // Entry already exists - add this event ID to the list
          const existingDept = departmentsMap.get(departmentKey);
          if (existingDept.eventIds && !existingDept.eventIds.includes(request.id)) {
            existingDept.eventIds.push(request.id);
          }
          // If multiple events, clear linkedEventId (it only works for single-event cards)
          if (existingDept.eventIds && existingDept.eventIds.length > 1) {
            existingDept.linkedEventId = null;
          }
          // Update co-host info if this request has co-hosts
          if (isCoHostedEvent) {
            existingDept.isCoHostedEvent = true;
            existingDept.coHostNames = [...new Set([...(existingDept.coHostNames || []), ...coHostNames])];
          }
        }

        const dept = departmentsMap.get(departmentKey);
        dept.totalRequests += 1;
        
        // Count completed events from event_requests
        if (
          request.status === 'completed' ||
          request.status === 'contact_completed'
        ) {
          dept.completedEventsFromRequests = (dept.completedEventsFromRequests || 0) + 1;
        }

        // Update department status based on most recent request
        const requestDate = new Date(request.createdAt || new Date());
        if (requestDate >= dept.latestRequestDate) {
          dept.latestRequestDate = requestDate;

          // Determine status: check if scheduled (future event) or completed/past
          if (
            request.status === 'completed' ||
            request.status === 'contact_completed'
          ) {
            dept.latestStatus = request.status;
            dept.hasHostedEvent = true;
            // Add sandwich count for completed events
            if (request.estimatedSandwichCount) {
              dept.totalSandwiches += request.estimatedSandwichCount;
            }
          } else if (request.status === 'scheduled') {
            // Check if the scheduled event is in the future or past
            const eventDate = request.desiredEventDate
              ? new Date(request.desiredEventDate)
              : null;
            const now = new Date();
            if (eventDate && eventDate > now) {
              dept.latestStatus = 'scheduled'; // Upcoming event
              dept.eventDate = request.desiredEventDate;
            } else if (eventDate && eventDate <= now) {
              dept.latestStatus = 'past'; // Past scheduled event
              dept.hasHostedEvent = true;
              dept.eventDate = request.desiredEventDate;
            } else {
              dept.latestStatus = 'scheduled'; // Scheduled but no date specified
            }
          } else if (request.status === 'contacted') {
            // For contacted events with a future date, consider them "in process"
            const eventDate = request.desiredEventDate
              ? new Date(request.desiredEventDate)
              : null;
            const now = new Date();
            if (eventDate && eventDate > now) {
              dept.latestStatus = 'in_process'; // Event being planned
            } else {
              dept.latestStatus = 'contacted';
            }
          } else {
            dept.latestStatus = request.status || 'new';
          }

          // Update event date from most recent request (normalize to ISO format)
          if (request.desiredEventDate) {
            try {
              // Normalize date to ISO format for consistent frontend parsing
              const dateObj = new Date(request.desiredEventDate);
              if (!isNaN(dateObj.getTime())) {
                // Format as YYYY-MM-DD for date-only or full ISO string
                dept.eventDate = dateObj.toISOString().split('T')[0];
              } else {
                dept.eventDate = null;
              }
            } catch {
              dept.eventDate = null;
            }
          }

          // Update TSP contact information from most recent request
          // Resolve tspContact if it's a user ID
          if (request.tspContact && userIdToName.has(request.tspContact)) {
            dept.tspContact = userIdToName.get(request.tspContact);
          } else {
            dept.tspContact = request.tspContact || null;
          }
          
          // Resolve tspContactAssigned if it's a user ID
          if (request.tspContactAssigned && userIdToName.has(request.tspContactAssigned)) {
            dept.tspContactAssigned = userIdToName.get(request.tspContactAssigned);
          } else {
            dept.tspContactAssigned = request.tspContactAssigned || null;
          }
          
          dept.assignedTo = request.assignedTo || null;
          // Resolve assignedTo user ID to name
          if (request.assignedTo && userIdToName.has(request.assignedTo)) {
            dept.assignedToName = userIdToName.get(request.assignedTo);
          } else {
            dept.assignedToName = null;
          }
        }
      });

      // STEP 2b: Process partner organizations - show events under both primary and partner orgs
      // This creates additional entries for partner organizations while tracking that they're linked
      allEventRequests.forEach((request) => {
        if (!request.partnerOrganizations || !Array.isArray(request.partnerOrganizations)) return;
        if (!request.organizationName) return;

        const primaryOrgName = request.organizationName;
        const primaryCanonicalName = canonicalOrgNameMap.get(primaryOrgName) || canonicalizeOrgName(primaryOrgName);
        const eventDate = request.desiredEventDate;
        const eventId = request.id;

        request.partnerOrganizations.forEach((partner: any) => {
          if (!partner.name || !partner.name.trim()) return;

          const partnerOrgName = partner.name.trim();

          // Skip if this partner matches the primary org name
          // (avoids creating duplicate entries when the same org is listed as both primary and partner)
          if (organizationNamesMatch(canonicalizeOrgName(partnerOrgName), primaryCanonicalName)) {
            return;
          }

          const partnerRole = partner.role || 'partner';

          // Get or create canonical name for partner org
          let partnerCanonicalName = canonicalOrgNameMap.get(partnerOrgName);
          if (!partnerCanonicalName) {
            const candidateCanonical = canonicalizeOrgName(partnerOrgName);
            // Check if it matches an existing canonical name
            for (const existingCanonical of canonicalOrgNameMap.values()) {
              if (organizationNamesMatch(candidateCanonical, existingCanonical)) {
                partnerCanonicalName = existingCanonical;
                break;
              }
            }
            if (!partnerCanonicalName) {
              partnerCanonicalName = candidateCanonical;
            }
            canonicalOrgNameMap.set(partnerOrgName, partnerCanonicalName);
          }

          // Create department key for partner org (using primary org contact info)
          const department = partner.department || request.department || '';
          const contactName =
            request.firstName && request.lastName
              ? `${request.firstName} ${request.lastName}`.trim()
              : request.firstName || request.lastName || request.email || 'Unknown Contact';
          const contactEmail = request.email || '';

          // In 'individual' mode, add event ID to key so each event gets its own card
          const partnerDeptKey = viewMode === 'individual'
            ? `${partnerCanonicalName}|${department}|${contactEmail}|${eventId}`
            : `${partnerCanonicalName}|${department}|${contactEmail}`;

          if (!departmentsMap.has(partnerDeptKey)) {
            departmentsMap.set(partnerDeptKey, {
              organizationName: partnerOrgName,
              canonicalName: partnerCanonicalName,
              department: department,
              contactName: contactName,
              contactEmail: contactEmail,
              contactPhone: request.phone,
              contacts: [{
                name: contactName,
                email: contactEmail,
                phone: request.phone,
              }],
              totalRequests: 0,
              latestStatus: 'new',
              latestRequestDate: request.createdAt || new Date(),
              hasHostedEvent: false,
              totalSandwiches: 0,
              eventDate: null,
              tspContact: null,
              tspContactAssigned: null,
              assignedTo: null,
              assignedToName: null,
              completedEventsFromRequests: 0,
              // Track this is a partner entry to avoid double-counting
              isPartnerEntry: true,
              primaryOrganization: primaryOrgName,
              partnerRole: partnerRole,
              linkedEventId: eventId,
            });
          }

          const partnerDept = departmentsMap.get(partnerDeptKey);
          partnerDept.totalRequests += 1;

          // Copy status and event details from primary org's request
          if (request.status === 'completed' || request.status === 'contact_completed') {
            partnerDept.completedEventsFromRequests = (partnerDept.completedEventsFromRequests || 0) + 1;
            partnerDept.hasHostedEvent = true;
          }

          // Update event date
          if (eventDate) {
            try {
              const dateObj = new Date(eventDate);
              if (!isNaN(dateObj.getTime())) {
                partnerDept.eventDate = dateObj.toISOString().split('T')[0];
              }
            } catch (e) {
              // Ignore date parsing errors
            }
          }

          // Update status
          const requestDate = new Date(request.createdAt || new Date());
          if (requestDate >= partnerDept.latestRequestDate) {
            partnerDept.latestRequestDate = requestDate;
            partnerDept.latestStatus = request.status || 'new';
          }
        });
      });

      // Build a lookup of event requests by canonical org name and date for deduplication
      // This prevents double-counting events that exist in both event_requests AND sandwich_collections
      // NOTE: Only event requests WITH dates can be used for date-based deduplication
      // Event requests WITHOUT dates are still included in the catalog but won't prevent
      // collections from being included (since we can't determine if they're the same event)
      const eventRequestLookup = new Map<string, Set<string>>();

      allEventRequests.forEach((request) => {
        if (!request.organizationName || !request.desiredEventDate) return;

        const canonicalOrgName = canonicalizeOrgName(request.organizationName);
        const eventDateStr = new Date(request.desiredEventDate).toISOString().split('T')[0];

        if (!eventRequestLookup.has(canonicalOrgName)) {
          eventRequestLookup.set(canonicalOrgName, new Set());
        }
        eventRequestLookup.get(canonicalOrgName)!.add(eventDateStr);
      });

      // Calculate actual sandwich totals and event counts from collections
      // Now tracks by organization+department to properly reflect department assignments
      const organizationSandwichData = new Map();

      allCollections.forEach((collection) => {
        const collectionDate = collection.collectionDate;

        // Helper function to process organization data from collections
        // Now accepts department parameter to properly track department-level data
        const processOrganization = (
          orgName: string,
          sandwichCount: number,
          department: string = ''
        ) => {
          if (
            !orgName ||
            orgName === 'Group' ||
            orgName === 'Groups' ||
            orgName === 'Unnamed Groups' ||
            !orgName.trim()
          ) {
            return;
          }

          const cleanOrgName = orgName.trim();
          const cleanDepartment = (department || '').trim();
          
          // Use canonical name mapping if available, otherwise create new canonical name
          // This ensures collections use same canonical names as event requests
          let canonicalOrgName = canonicalOrgNameMap.get(cleanOrgName);
          if (!canonicalOrgName) {
            const candidateCanonical = canonicalizeOrgName(cleanOrgName);
            // Check if this matches an existing canonical name
            for (const existingCanonical of canonicalOrgNameMap.values()) {
              if (organizationNamesMatch(candidateCanonical, existingCanonical)) {
                canonicalOrgName = existingCanonical;
                break;
              }
            }
            if (!canonicalOrgName) {
              canonicalOrgName = candidateCanonical;
            }
            canonicalOrgNameMap.set(cleanOrgName, canonicalOrgName);
          }

          // DEDUPLICATION: Check if this collection matches an event request within ±7 days
          // This prevents the same event from being counted twice when it appears in both:
          // 1. event_requests (planned event with date)
          // 2. sandwich_collections (actual logged collection)
          //
          // If an event request exists within 7 days, we skip the collection to avoid duplication.
          // The 7-day window allows for slight date discrepancies due to late logging or date changes.
          // Collections are only deduplicated if the organization has event requests WITH dates.
          // ENHANCED: Now uses fuzzy matching to catch name variations (e.g., "Allied World" vs "Allied World Assurance")
          if (collectionDate) {
            const collectionDateObj = new Date(collectionDate);
            let foundMatch = false;

            // Check all event requests for matching organization names (exact or partial)
            for (const [requestCanonicalName, requestDates] of eventRequestLookup.entries()) {
              if (organizationNamesMatch(canonicalOrgName, requestCanonicalName)) {
                // Organization names match - now check if dates are within 7 days
                for (const requestDateStr of requestDates) {
                  const requestDateObj = new Date(requestDateStr);
                  const daysDiff = Math.abs(
                    (collectionDateObj.getTime() - requestDateObj.getTime()) / (1000 * 60 * 60 * 24)
                  );

                  if (daysDiff <= 7) {
                    // This collection matches an event request - skip to avoid double-counting
                    foundMatch = true;
                    break;
                  }
                }
                if (foundMatch) break;
              }
            }

            if (foundMatch) {
              return; // Skip this collection to avoid duplication
            }
          }

          // Track sandwich totals using canonical name + department for proper grouping
          // This ensures department-specific collections are tracked separately
          const orgDeptKey = `${canonicalOrgName}|${cleanDepartment}`;
          
          if (!organizationSandwichData.has(orgDeptKey)) {
            organizationSandwichData.set(orgDeptKey, {
              canonicalName: canonicalOrgName,
              originalName: cleanOrgName, // Preserve original display name
              department: cleanDepartment,
              totalSandwiches: 0,
              eventCount: 0,
              eventDates: new Set(),
              pastEvents: [], // Track individual past events
            });
          }

          const orgData = organizationSandwichData.get(orgDeptKey);
          orgData.totalSandwiches += sandwichCount || 0;

          // Track unique event dates to calculate frequency
          if (collectionDate) {
            orgData.eventDates.add(collectionDate);
            orgData.eventCount = orgData.eventDates.size;
            
            // Add individual past event details
            orgData.pastEvents.push({
              date: collectionDate,
              sandwichCount: sandwichCount || 0,
              department: cleanDepartment,
            });
          }
        };

        // Process group data: prioritize JSON groupCollections to avoid duplicates
        if (
          collection.groupCollections &&
          Array.isArray(collection.groupCollections) &&
          collection.groupCollections.length > 0
        ) {
          // Use new JSON group collections data (preferred)
          // Now passes department from groupCollections JSON
          collection.groupCollections.forEach((group: any) => {
            // Include groups even if count is 0 (check for undefined/null instead of truthy)
            if (group.name && group.count != null) {
              processOrganization(group.name, group.count, group.department || '');
            }
          });
        } else {
          // Fall back to legacy group data only if JSON is empty
          // Legacy fields don't have department info
          if (collection.group1Name && collection.group1Count != null) {
            processOrganization(collection.group1Name, collection.group1Count, '');
          }
          if (collection.group2Name && collection.group2Count != null) {
            processOrganization(collection.group2Name, collection.group2Count, '');
          }
        }
      });

      // Helper function to calculate event frequency
      const calculateEventFrequency = (eventDates: Set<string>) => {
        if (eventDates.size === 0) return null;
        if (eventDates.size === 1) {
          // Show time since last event for single events
          const lastEventDate = new Date(Array.from(eventDates)[0]);
          const now = new Date();
          const daysSince = Math.floor((now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSince < 30) {
            return `${daysSince} days ago`;
          } else if (daysSince < 365) {
            const monthsSince = Math.floor(daysSince / 30);
            return `${monthsSince} month${monthsSince > 1 ? 's' : ''} ago`;
          } else {
            const yearsSince = Math.floor(daysSince / 365);
            return `${yearsSince} year${yearsSince > 1 ? 's' : ''} ago`;
          }
        }

        const dates = Array.from(eventDates)
          .map((d) => new Date(d))
          .sort((a, b) => a.getTime() - b.getTime());
        const firstEvent = dates[0];
        const lastEvent = dates[dates.length - 1];
        const daysDiff =
          (lastEvent.getTime() - firstEvent.getTime()) / (1000 * 60 * 60 * 24);
        const yearsDiff = daysDiff / 365.25;

        if (yearsDiff < 1) {
          return `${eventDates.size} events in ${Math.round(
            daysDiff / 30
          )} months`;
        } else {
          const eventsPerYear = eventDates.size / yearsDiff;
          if (eventsPerYear >= 1) {
            return `${Math.round(eventsPerYear * 10) / 10} events/year`;
          } else {
            return `${eventDates.size} events in ${Math.round(
              yearsDiff
            )} years`;
          }
        }
      };

      // Update departments with actual collection data
      // Now matches by organization+department for proper alignment
      organizationSandwichData.forEach((orgData, orgDeptKey) => {
        // orgDeptKey format: "canonicalOrgName|department"
        const canonicalOrgName = orgData.canonicalName;
        const collectionDepartment = orgData.department || '';
        
        // Find existing department entries for this organization using canonical matching
        // ENHANCED: Now matches by both organization name AND department
        let foundExisting = false;

        // Sort past events by date (most recent first)
        const sortedPastEvents = (orgData.pastEvents || []).sort((a: any, b: any) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        departmentsMap.forEach((dept, key) => {
          // Match by organization name AND department (if collection has department)
          const orgMatches = organizationNamesMatch(dept.canonicalName, canonicalOrgName);
          // Safely normalize department strings before comparison to avoid null dereference
          const normalizedDeptDepartment = (dept.department || '').toLowerCase().trim();
          const normalizedCollectionDepartment = (collectionDepartment || '').toLowerCase().trim();
          const deptMatches = !collectionDepartment || 
            normalizedDeptDepartment === normalizedCollectionDepartment;
          
          if (orgMatches && deptMatches) {
            foundExisting = true;
            dept.actualSandwichTotal = (dept.actualSandwichTotal || 0) + orgData.totalSandwiches;
            dept.actualEventCount = (dept.actualEventCount || 0) + orgData.eventCount;
            dept.eventFrequency = calculateEventFrequency(orgData.eventDates);
            dept.hasHostedEvent = true;
            dept.pastEvents = [...(dept.pastEvents || []), ...sortedPastEvents].sort((a: any, b: any) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            // Update latest collection date and calculate latest activity date
            const latestCollectionDate = Math.max(
              ...(Array.from(orgData.eventDates) as string[]).map((d: string) =>
                new Date(d).getTime()
              )
            );
            dept.latestCollectionDate = new Date(latestCollectionDate)
              .toISOString()
              .split('T')[0];

            // Calculate latest activity date for proper sorting
            const requestTime = new Date(dept.latestRequestDate).getTime();
            const collectionTime = latestCollectionDate;
            dept.latestActivityDate = new Date(
              Math.max(requestTime, collectionTime)
            );
          }
        });

        // Add as historical organization+department if not found in event requests
        // This creates a new card for organizations/departments only known from collections
        if (!foundExisting) {
          const departmentKey = `${canonicalOrgName}|${collectionDepartment}|`; // Include department for proper grouping
          const latestCollectionDate = Math.max(
            ...(Array.from(orgData.eventDates) as string[]).map((d: string) => new Date(d).getTime())
          );

          departmentsMap.set(departmentKey, {
            organizationName: orgData.originalName,
            canonicalName: canonicalOrgName,
            department: collectionDepartment, // Include department from collection
            contactName: '',
            contactEmail: '',
            contactPhone: '',
            contacts: [],
            totalRequests: 0,
            latestStatus: 'past',
            latestRequestDate: new Date(latestCollectionDate),
            latestActivityDate: new Date(latestCollectionDate),
            hasHostedEvent: true,
            totalSandwiches: 0,
            actualSandwichTotal: orgData.totalSandwiches,
            actualEventCount: orgData.eventCount,
            eventFrequency: calculateEventFrequency(orgData.eventDates),
            // Use the most recent collection date as the eventDate for display
            eventDate: new Date(latestCollectionDate).toISOString().split('T')[0],
            latestCollectionDate: new Date(latestCollectionDate)
              .toISOString()
              .split('T')[0],
            pastEvents: sortedPastEvents,
            isFromCollectionOnly: true, // Flag to indicate this is from collection log only
          });
        }
      });

      // Initialize latestActivityDate and actualEventCount for departments that don't have collection data
      departmentsMap.forEach((dept, key) => {
        if (!dept.latestActivityDate) {
          dept.latestActivityDate = dept.latestRequestDate;
        }
        
        // If no collection data but has completed events from requests, use that count
        if (!dept.actualEventCount && dept.completedEventsFromRequests > 0) {
          dept.actualEventCount = dept.completedEventsFromRequests;
        }
      });

      // Convert Map to array and group by canonical organization name
      const organizationsMap = new Map();

      departmentsMap.forEach((dept) => {
        const canonicalKey = dept.canonicalName;

        if (!organizationsMap.has(canonicalKey)) {
          organizationsMap.set(canonicalKey, {
            canonicalName: canonicalKey,
            displayName: dept.organizationName, // Use first occurrence as display name
            nameVariations: new Set([dept.organizationName]),
            departments: [],
          });
        }

        const org = organizationsMap.get(canonicalKey);

        // Track all name variations for this organization
        org.nameVariations.add(dept.organizationName);

        // Choose the most "complete" name as display name (longest non-empty name)
        if (dept.organizationName.length > org.displayName.length) {
          org.displayName = dept.organizationName;
        }

        // Determine contact name label for entries without contact info
        let contactNameLabel = 'Historical Organization';
        if (!dept.contactName && dept.latestCollectionDate) {
          const collectionYear = new Date(dept.latestCollectionDate).getFullYear();
          if (collectionYear >= 2025) {
            contactNameLabel = 'Collection Logged Only';
          }
        }

        // Each entry now represents a unique contact (one card per contact/event)
        org.departments.push({
          organizationName: org.displayName, // Use unified display name
          department: dept.department,
          contactName: dept.contactName || contactNameLabel,
          email: dept.contactEmail || '',
          phone: dept.contactPhone || '',
          allContacts: dept.contacts,
          status: dept.latestStatus,
          totalRequests: dept.totalRequests,
          hasHostedEvent: dept.hasHostedEvent,
          totalSandwiches: dept.totalSandwiches,
          actualSandwichTotal: dept.actualSandwichTotal || 0,
          actualEventCount: dept.actualEventCount || 0,
          eventFrequency: dept.eventFrequency || null,
          eventDate: dept.eventDate,
          latestRequestDate: dept.latestRequestDate,
          latestCollectionDate: dept.latestCollectionDate || null,
          latestActivityDate: dept.latestActivityDate,
          tspContact: dept.tspContact || null,
          tspContactAssigned: dept.tspContactAssigned || null,
          assignedTo: dept.assignedTo || null,
          assignedToName: dept.assignedToName || null,
          pastEvents: dept.pastEvents || [], // Include all past events in array
          // Partner/co-host tracking fields
          isPartnerEntry: dept.isPartnerEntry || false,
          primaryOrganization: dept.primaryOrganization || null,
          partnerRole: dept.partnerRole || null,
          linkedEventId: dept.linkedEventId || null,
          eventIds: dept.eventIds || [], // All event IDs aggregated in this card
          isFromCollectionOnly: dept.isFromCollectionOnly || false,
          isCoHostedEvent: dept.isCoHostedEvent || false,
          coHostNames: dept.coHostNames || [],
        });
      });

      // Convert to final format and sort
      const organizations = Array.from(organizationsMap.entries()).map(
        ([_, org]) => {
          // Look up category information for this organization
          // ENHANCED: Use fuzzy matching to find category info
          let categoryInfo = organizationCategoryMap.get(org.canonicalName);
          if (!categoryInfo) {
            // Search for matching organization name
            for (const [categoryKey, info] of organizationCategoryMap.entries()) {
              if (organizationNamesMatch(categoryKey, org.canonicalName)) {
                categoryInfo = info;
                break;
              }
            }
          }
          
          return {
            name: org.displayName,
            canonicalName: org.canonicalName,
            nameVariations: Array.from(org.nameVariations),
            // Add category fields from organizations table
            category: categoryInfo?.category || null,
            schoolClassification: categoryInfo?.schoolClassification || null,
            isReligious: categoryInfo?.isReligious || false,
            departments: org.departments.sort(
              (a: { latestActivityDate: Date | string }, b: { latestActivityDate: Date | string }) =>
                new Date(b.latestActivityDate).getTime() -
                new Date(a.latestActivityDate).getTime()
            ),
          };
        }
      );

      // Sort organizations by most recent activity across all departments
      organizations.sort((a, b) => {
        const aLatest = Math.max(
          ...a.departments.map((d: { latestActivityDate: Date | string }) => new Date(d.latestActivityDate).getTime())
        );
        const bLatest = Math.max(
          ...b.departments.map((d: { latestActivityDate: Date | string }) => new Date(d.latestActivityDate).getTime())
        );
        return bLatest - aLatest;
      });

      res.json({ groups: organizations });
    } catch (error) {
      logger.error('Error fetching organizations catalog:', error);
      res
        .status(500)
        .json({ message: 'Failed to fetch organizations catalog' });
    }
  });

  // Get detailed event history for a specific organization
  router.get(
    '/details/:organizationName',
    deps.isAuthenticated,
    async (req, res) => {
      try {
        const { organizationName } = req.params;
        const decodedOrgName = decodeURIComponent(organizationName);
        const canonicalSearchName = canonicalizeOrgName(decodedOrgName);

        // Get all event requests for this organization using FUZZY canonical matching
        const eventRequests = await storage.getAllEventRequests();
        const orgEventRequests = eventRequests.filter(
          (request) => {
            const requestCanonical = canonicalizeOrgName(request.organizationName);
            const matches = organizationNamesMatch(requestCanonical, canonicalSearchName);
            if (matches) {
              logger.log(`[Groups Catalog Details] Matched event request: ${request.organizationName} (canonical: ${requestCanonical}) with search: ${decodedOrgName} (canonical: ${canonicalSearchName})`);
            }
            return matches;
          }
        );
        
        logger.log(`[Groups Catalog Details] Found ${orgEventRequests.length} event requests for ${decodedOrgName}`);

        // Get all sandwich collections for this organization using FUZZY canonical matching
        const allCollections = await storage.getAllSandwichCollections();
        const orgCollections = allCollections.filter((collection) => {
          // Check if organization name matches in any of the group fields using FUZZY canonical matching
          const matchesGroup1 =
            collection.group1Name &&
            organizationNamesMatch(
              canonicalizeOrgName(collection.group1Name),
              canonicalSearchName
            );
          const matchesGroup2 =
            collection.group2Name &&
            organizationNamesMatch(
              canonicalizeOrgName(collection.group2Name),
              canonicalSearchName
            );

          // Check JSON group collections using FUZZY canonical matching
          let matchesGroupCollections = false;
          if (
            collection.groupCollections &&
            Array.isArray(collection.groupCollections)
          ) {
            matchesGroupCollections = collection.groupCollections.some(
              (group: any) =>
                group.name &&
                organizationNamesMatch(
                  canonicalizeOrgName(group.name),
                  canonicalSearchName
                )
            );
          }

          return matchesGroup1 || matchesGroup2 || matchesGroupCollections;
        });

        // Process event requests into unified format
        const eventRequestHistory = orgEventRequests.map((request) => ({
          type: 'event_request',
          id: request.id,
          date: request.desiredEventDate || request.createdAt,
          status: request.status,
          department: request.department || '',
          contactName:
            request.firstName && request.lastName
              ? `${request.firstName} ${request.lastName}`.trim()
              : request.firstName || request.lastName || request.email || 'Unknown Contact',
          email: request.email,
          phone: request.phone,
          estimatedSandwiches: request.estimatedSandwichCount || 0,
          actualSandwiches: 0,
          notes: request.message || '',
          createdAt: request.createdAt,
          lastUpdated: request.updatedAt || request.createdAt,
        }));

        // Process sandwich collections into unified format
        const collectionHistory = orgCollections.map((collection) => {
          // Calculate sandwiches for this organization from this collection using canonical matching
          let sandwichCount = 0;

          // Check legacy fields using canonical names
          if (
            collection.group1Name &&
            canonicalizeOrgName(collection.group1Name) === canonicalSearchName
          ) {
            sandwichCount += collection.group1Count || 0;
          }
          if (
            collection.group2Name &&
            canonicalizeOrgName(collection.group2Name) === canonicalSearchName
          ) {
            sandwichCount += collection.group2Count || 0;
          }

          // Check JSON group collections using canonical names
          if (
            collection.groupCollections &&
            Array.isArray(collection.groupCollections)
          ) {
            collection.groupCollections.forEach((group: any) => {
              if (
                group.name &&
                canonicalizeOrgName(group.name) === canonicalSearchName
              ) {
                sandwichCount += group.count || 0;
              }
            });
          }

          return {
            type: 'sandwich_collection',
            id: collection.id,
            date: collection.collectionDate,
            status: 'completed',
            hostName: collection.hostName,
            department: '',
            contactName: collection.createdByName || 'Unknown',
            email: '',
            phone: '',
            estimatedSandwiches: 0,
            actualSandwiches: sandwichCount,
            notes: `Collection hosted by ${collection.hostName}`,
            createdAt: collection.submittedAt,
            lastUpdated: collection.submittedAt,
          };
        });

        // Combine and sort all events by date
        const allEvents = [...eventRequestHistory, ...collectionHistory].sort(
          (a, b) => {
            const dateA = new Date(a.date || a.createdAt).getTime();
            const dateB = new Date(b.date || b.createdAt).getTime();
            return dateB - dateA; // Most recent first
          }
        );

        // Calculate summary statistics
        const totalEvents = allEvents.length;
        const completedEvents = allEvents.filter(
          (event) =>
            event.status === 'completed' ||
            event.status === 'contact_completed' ||
            event.type === 'sandwich_collection'
        ).length;
        const totalActualSandwiches = allEvents.reduce(
          (sum, event) => sum + event.actualSandwiches,
          0
        );
        const totalEstimatedSandwiches = allEvents.reduce(
          (sum, event) => sum + event.estimatedSandwiches,
          0
        );

        // Get unique contacts
        const uniqueContacts = Array.from(
          new Map(
            allEvents
              .filter((event) => event.email)
              .map((event) => [
                event.email,
                {
                  name: event.contactName,
                  email: event.email,
                  phone: event.phone,
                  department: event.department,
                },
              ])
          ).values()
        );

        // Calculate event frequency
        let eventFrequency = null;
        if (allEvents.length === 1) {
          // Show time since last event for single events
          const lastEventDate = new Date(allEvents[0].date || allEvents[0].createdAt);
          const now = new Date();
          const daysSince = Math.floor((now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSince < 30) {
            eventFrequency = `${daysSince} days ago`;
          } else if (daysSince < 365) {
            const monthsSince = Math.floor(daysSince / 30);
            eventFrequency = `${monthsSince} month${monthsSince > 1 ? 's' : ''} ago`;
          } else {
            const yearsSince = Math.floor(daysSince / 365);
            eventFrequency = `${yearsSince} year${yearsSince > 1 ? 's' : ''} ago`;
          }
        } else if (allEvents.length > 1) {
          const dates = allEvents
            .map((event) => new Date(event.date || event.createdAt))
            .sort((a, b) => a.getTime() - b.getTime());
          const firstEvent = dates[0];
          const lastEvent = dates[dates.length - 1];
          const daysDiff =
            (lastEvent.getTime() - firstEvent.getTime()) /
            (1000 * 60 * 60 * 24);
          const yearsDiff = daysDiff / 365.25;

          if (yearsDiff < 1) {
            eventFrequency = `${allEvents.length} events in ${Math.round(
              daysDiff / 30
            )} months`;
          } else {
            const eventsPerYear = allEvents.length / yearsDiff;
            if (eventsPerYear >= 1) {
              eventFrequency = `${
                Math.round(eventsPerYear * 10) / 10
              } events/year`;
            } else {
              eventFrequency = `${allEvents.length} events in ${Math.round(
                yearsDiff
              )} years`;
            }
          }
        }

        res.json({
          organizationName: decodedOrgName,
          summary: {
            totalEvents,
            completedEvents,
            totalActualSandwiches,
            totalEstimatedSandwiches,
            eventFrequency,
          },
          contacts: uniqueContacts,
          events: allEvents,
        });
      } catch (error) {
        logger.error(
          `Error fetching details for organization ${req.params.organizationName}:`,
          error
        );
        res
          .status(500)
          .json({ message: 'Failed to fetch organization details' });
      }
    }
  );

  // POST /api/groups-catalog/rename - Rename organization/department across all source records
  // If eventId is provided, only update that specific event (for single-card edits)
  router.post('/rename', deps.isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { oldName, newName, oldDepartment, newDepartment, partnerOrganizations, eventId, eventIds } = req.body;

      // Validation
      if (!oldName || typeof oldName !== 'string') {
        return res.status(400).json({ message: 'Current organization name is required' });
      }

      const trimmedOldName = oldName.trim();
      // Allow newName to be null/empty for co-hosted events
      const trimmedNewName = (newName && typeof newName === 'string') ? newName.trim() : '';
      // Preserve empty string as a valid value (means "no department") - only use null if undefined
      const trimmedOldDept = typeof oldDepartment === 'string' ? oldDepartment.trim() : null;
      const trimmedNewDept = typeof newDepartment === 'string' ? newDepartment.trim() : null;
      const specificEventId = eventId && typeof eventId === 'number' ? eventId : null;
      // Support multiple event IDs for aggregated cards
      const specificEventIds = Array.isArray(eventIds) && eventIds.length > 0
        ? eventIds.filter((id: any) => typeof id === 'number')
        : null;

      // Process partner organizations - filter and validate
      const validPartnerOrgs = Array.isArray(partnerOrganizations)
        ? partnerOrganizations
            .filter((p: any) => p && typeof p.name === 'string' && p.name.trim())
            .map((p: any) => ({
              name: p.name.trim(),
              role: ['co-host', 'partner', 'sponsor'].includes(p.role) ? p.role : 'partner',
            }))
        : null;

      // Either need a new org name OR co-hosts (for truly co-hosted events)
      const hasCoHosts = validPartnerOrgs && validPartnerOrgs.length > 0;
      if (!trimmedNewName && !hasCoHosts) {
        return res.status(400).json({ message: 'Please provide an organization name or add co-hosting organizations' });
      }

      logger.info('Renaming organization', {
        oldName: trimmedOldName,
        newName: trimmedNewName,
        oldDepartment: trimmedOldDept,
        newDepartment: trimmedNewDept,
        partnerOrganizations: validPartnerOrgs,
        eventId: specificEventId,
        eventIds: specificEventIds,
        userId: req.user?.id,
      });

      let updatedEventRequests = 0;
      let updatedCollections = 0;

      // For co-hosted events with no primary org, use the first co-host as the organizationName
      // This ensures the record isn't orphaned while still having all orgs as co-hosts
      const effectiveNewName = trimmedNewName || (hasCoHosts ? validPartnerOrgs![0].name : '');

      // 1. Update event_requests
      // If specificEventId is provided, only update that one event (single-card edit mode)
      // If specificEventIds array is provided, only update those events (aggregated card mode)
      // Otherwise, update all matching events (bulk rename mode)
      if (specificEventId) {
        // Single event update mode - much faster, only fetch and update one record
        const request = await storage.getEventRequest(specificEventId);
        if (request && request.organizationName === trimmedOldName) {
          const updates: any = {};

          // Update organization name
          updates.organizationName = effectiveNewName;

          // Add partner organizations if provided
          if (validPartnerOrgs && validPartnerOrgs.length > 0) {
            updates.partnerOrganizations = validPartnerOrgs;
          }

          // Update department if provided (allow clearing with empty string)
          if (trimmedNewDept !== null || newDepartment === '') {
            updates.department = trimmedNewDept || null;
          }

          await storage.updateEventRequest(specificEventId, updates);
          updatedEventRequests = 1;
        }
      } else if (specificEventIds && specificEventIds.length > 0) {
        // Aggregated card update mode - update specific events by ID
        for (const eventIdToUpdate of specificEventIds) {
          const request = await storage.getEventRequest(eventIdToUpdate);
          if (request && request.organizationName === trimmedOldName) {
            const updates: any = {};

            // Update organization name
            updates.organizationName = effectiveNewName;

            // Add partner organizations if provided
            if (validPartnerOrgs && validPartnerOrgs.length > 0) {
              updates.partnerOrganizations = validPartnerOrgs;
            }

            // Update department if provided (allow clearing with empty string)
            if (trimmedNewDept !== null || newDepartment === '') {
              updates.department = trimmedNewDept || null;
            }

            await storage.updateEventRequest(eventIdToUpdate, updates);
            updatedEventRequests++;
          }
        }
      } else {
        // Bulk update mode - iterate through events matching org + dept
        // When oldDepartment is provided, only update events that match BOTH org AND department
        // This prevents accidentally updating unrelated events with different departments
        const allEventRequests = await storage.getAllEventRequests();
        for (const request of allEventRequests) {
          let shouldUpdate = false;
          const updates: any = {};

          // Check if organization name matches
          const orgMatches = request.organizationName === trimmedOldName;
          if (!orgMatches) continue; // Skip if org doesn't match

          // Check if department matches (when oldDepartment is specified)
          const currentDept = request.department || null;
          const deptMatches = trimmedOldDept === null
            ? true // No dept filter specified, match all
            : (currentDept === trimmedOldDept || (trimmedOldDept === '' && !currentDept));

          if (!deptMatches) continue; // Skip if dept doesn't match

          // At this point, org matches and dept matches (or no dept filter)
          updates.organizationName = effectiveNewName;
          shouldUpdate = true;

          // Add partner organizations if provided
          if (validPartnerOrgs && validPartnerOrgs.length > 0) {
            updates.partnerOrganizations = validPartnerOrgs;
          }

          // Update department if specified
          // Allow clearing: if oldDept was explicitly provided and newDept is null/empty
          const isClearing = trimmedOldDept !== null && trimmedNewDept === null;
          const isChanging = trimmedNewDept !== null && trimmedNewDept !== currentDept;

          if (isClearing || isChanging) {
            updates.department = trimmedNewDept; // null will clear it
          }

          if (shouldUpdate) {
            try {
              await storage.updateEventRequest(request.id, updates);
              updatedEventRequests++;
            } catch (updateError) {
              logger.error('Failed to update event request', {
                requestId: request.id,
                updates,
                error: updateError instanceof Error ? updateError.message : updateError,
              });
              throw updateError;
            }
          }
        }
      }

      // 2. Update sandwich_collections (group1Name, group2Name, and groupCollections JSON)
      // Skip collection updates if:
      // - we're in single-event or aggregated-card mode (editing specific events)
      // - we're editing a department-level card (collections don't have departments)
      // Note: empty string departments ("") mean "no department" and should NOT be treated as a department edit
      const isDepartmentEdit = (trimmedOldDept !== null && trimmedOldDept !== '') || (trimmedNewDept !== null && trimmedNewDept !== '');
      if (!specificEventId && !specificEventIds && !isDepartmentEdit) {
        const allCollections = await storage.getAllSandwichCollections();
        for (const collection of allCollections) {
          let shouldUpdate = false;
          const updates: any = {};

          // Check group1Name
          if (collection.group1Name === trimmedOldName) {
            updates.group1Name = effectiveNewName;
            shouldUpdate = true;
          }

          // Check group2Name
          if (collection.group2Name === trimmedOldName) {
            updates.group2Name = effectiveNewName;
            shouldUpdate = true;
          }

          // Check groupCollections JSON array
          if (collection.groupCollections && Array.isArray(collection.groupCollections)) {
            const updatedGroupCollections = collection.groupCollections.map((group: any) => {
              if (group && typeof group === 'object') {
                let updatedGroup = { ...group };

                // Update name field
                if (group.name === trimmedOldName) {
                  updatedGroup.name = effectiveNewName;
                  shouldUpdate = true;
                }

                // Update department field if applicable (only if new department was explicitly provided)
                if (trimmedOldDept !== null && group.department === trimmedOldDept && trimmedNewDept !== null) {
                  updatedGroup.department = trimmedNewDept;
                  shouldUpdate = true;
                }

                return updatedGroup;
              }
              return group;
            });

            if (shouldUpdate) {
              updates.groupCollections = updatedGroupCollections;
            }
          }

          if (shouldUpdate) {
            await storage.updateSandwichCollection(collection.id, updates);
            updatedCollections++;
          }
        }

        // 3. Update the organizations table if it exists (only for bulk rename mode)
        const allOrganizations = await storage.getAllOrganizations();
        for (const org of allOrganizations) {
          if (org.name === trimmedOldName) {
            await storage.updateOrganization(org.id, { name: effectiveNewName });
          }
        }
      }

      logger.info('Organization rename completed', {
        oldName: trimmedOldName,
        newName: effectiveNewName,
        isCoHostedEvent: !trimmedNewName && hasCoHosts,
        updatedEventRequests,
        updatedCollections,
      });

      res.json({
        success: true,
        oldName: trimmedOldName,
        newName: effectiveNewName,
        isCoHostedEvent: !trimmedNewName && hasCoHosts,
        updatedEventRequests,
        updatedCollections,
      });
    } catch (error) {
      logger.error('Error renaming organization:', error);
      res.status(500).json({ message: 'Failed to rename organization' });
    }
  });

  // POST /api/organizations/upsert - Create or update organization category
  router.post('/upsert', deps.isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, category, schoolClassification, isReligious } = req.body;

      // Validation
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'Organization name is required' });
      }

      if (!category || typeof category !== 'string') {
        return res.status(400).json({ message: 'Category is required' });
      }

      // Validate category format (alphanumeric with underscores, reasonable length)
      const trimmedCategory = category.trim().toLowerCase();
      if (trimmedCategory.length < 2 || trimmedCategory.length > 50) {
        return res.status(400).json({ message: 'Category must be between 2 and 50 characters' });
      }
      if (!/^[a-z0-9_]+$/.test(trimmedCategory)) {
        return res.status(400).json({ message: 'Category can only contain letters, numbers, and underscores' });
      }

      // Get all organizations to find matching one
      const allOrganizations = await storage.getAllOrganizations();
      const canonicalSearchName = canonicalizeOrgName(name);

      // Find existing organization by canonical name matching
      let existingOrg = null;
      for (const org of allOrganizations) {
        const canonicalOrgName = canonicalizeOrgName(org.name);
        if (organizationNamesMatch(canonicalOrgName, canonicalSearchName)) {
          // Prefer organization-level entries (without department)
          if (!existingOrg || (!org.department && existingOrg.department)) {
            existingOrg = org;
          }
        }
      }

      let result;

      if (existingOrg) {
        // Update existing organization
        result = await storage.updateOrganization(existingOrg.id, {
          category: trimmedCategory,
          schoolClassification: trimmedCategory === 'school' ? (schoolClassification || null) : null,
          isReligious: isReligious || false,
        });

        logger.log(`Updated organization category: ${name} (ID: ${existingOrg.id}) -> ${trimmedCategory}`);
      } else {
        // Create new organization
        result = await storage.createOrganization({
          name,
          category: trimmedCategory,
          schoolClassification: trimmedCategory === 'school' ? (schoolClassification || null) : null,
          isReligious: isReligious || false,
          totalEvents: 0,
        });

        logger.log(`Created new organization: ${name} with category ${trimmedCategory}`);
      }

      res.json(result);
    } catch (error) {
      logger.error('Error upserting organization:', error);
      res.status(500).json({ message: 'Failed to upsert organization' });
    }
  });

  return router;
}

export default createGroupsCatalogRoutes;
