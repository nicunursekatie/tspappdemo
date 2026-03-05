import { Router } from 'express';
import { storage } from '../storage-wrapper';
import { logger } from '../utils/production-safe-logger';
import { canonicalizeOrgName } from '../utils/organization-canonicalization';

interface GroupsCatalogDependencies {
  isAuthenticated: any;
}

export function createGroupsCatalogRoutes(deps: GroupsCatalogDependencies) {
  const router = Router();

  // Groups Catalog: Complete directory of all organizations (current requests + historical hosts)
  router.get('/', deps.isAuthenticated, async (req, res) => {
    try {
      const user = req.user;

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

      // Create a map to aggregate data by organization and department
      const departmentsMap = new Map();

      allEventRequests.forEach((request) => {
        const orgName = request.organizationName;
        const department = request.department || '';
        const contactName =
          request.firstName && request.lastName
            ? `${request.firstName} ${request.lastName}`.trim()
            : request.firstName || request.lastName || 'Contact Not Yet Assigned';
        const contactEmail = request.email;

        // Only skip if organization name is missing - contact name is optional
        if (!orgName) return;

        // Create a unique key using canonical name for matching
        // Each event request gets its own card (use request.id for uniqueness)
        const canonicalOrgName = canonicalizeOrgName(orgName);
        const departmentKey = `${canonicalOrgName}|${department}|${contactName}|${request.id}`;

        // Track department-level aggregation
        if (!departmentsMap.has(departmentKey)) {
          // Normalize event date immediately
          let normalizedEventDate = null;
          if (request.desiredEventDate) {
            try {
              const dateObj = new Date(request.desiredEventDate);
              if (!isNaN(dateObj.getTime())) {
                normalizedEventDate = dateObj.toISOString().split('T')[0];
              }
            } catch {
              normalizedEventDate = null;
            }
          }

          const newDept = {
            organizationName: orgName, // Preserve original display name
            canonicalName: canonicalOrgName, // Store canonical for matching
            department: department,
            contacts: [],
            totalRequests: 0,
            latestStatus: request.status || 'new',
            latestRequestDate: request.createdAt || new Date(),
            hasHostedEvent: request.status === 'completed' || request.status === 'contact_completed',
            totalSandwiches: request.estimatedSandwichCount || 0,
            actualSandwichTotal: 0,
            actualEventCount: 1, // Each individual event request is 1 event
            eventDate: normalizedEventDate,
            tspContact: request.tspContact || null,
            tspContactAssigned: request.tspContactAssigned || null,
            assignedTo: request.assignedTo || null,
            assignedToName: request.assignedTo && userIdToName.has(request.assignedTo)
              ? userIdToName.get(request.assignedTo)
              : null,
            eventRequestId: request.id, // Store event request ID for tracking
          };
          departmentsMap.set(departmentKey, newDept);
        }

        const dept = departmentsMap.get(departmentKey);
        dept.totalRequests += 1;

        // Add contact if not already present
        const existingContact = dept.contacts.find(
          (c: { name: string; email: string }) => c.name === contactName && c.email === contactEmail
        );

        if (!existingContact) {
          dept.contacts.push({
            name: contactName,
            email: contactEmail,
            phone: request.phone,
          });
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
          dept.tspContact = request.tspContact || null;
          dept.tspContactAssigned = request.tspContactAssigned || null;
          dept.assignedTo = request.assignedTo || null;
          // Resolve assignedTo user ID to name
          if (request.assignedTo && userIdToName.has(request.assignedTo)) {
            dept.assignedToName = userIdToName.get(request.assignedTo);
          } else {
            dept.assignedToName = null;
          }
        }
      });

      // Calculate actual sandwich totals and event counts from collections
      const organizationSandwichData = new Map();

      allCollections.forEach((collection) => {
        const collectionDate = collection.collectionDate;

        // Helper function to process organization data from collections
        const processOrganization = (
          orgName: string,
          sandwichCount: number
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
          const canonicalOrgName = canonicalizeOrgName(cleanOrgName);

          // Track sandwich totals using canonical name for matching
          if (!organizationSandwichData.has(canonicalOrgName)) {
            organizationSandwichData.set(canonicalOrgName, {
              originalName: cleanOrgName, // Preserve original display name
              totalSandwiches: 0,
              eventCount: 0,
              eventDates: new Set(),
            });
          }

          const orgData = organizationSandwichData.get(canonicalOrgName);
          orgData.totalSandwiches += sandwichCount || 0;

          // Track unique event dates to calculate frequency
          if (collectionDate) {
            orgData.eventDates.add(collectionDate);
            orgData.eventCount = orgData.eventDates.size;
          }
        };

        // Process legacy group data
        if (collection.group1Name && collection.group1Count) {
          processOrganization(collection.group1Name, collection.group1Count);
        }
        if (collection.group2Name && collection.group2Count) {
          processOrganization(collection.group2Name, collection.group2Count);
        }

        // Process new JSON group collections data
        if (
          collection.groupCollections &&
          Array.isArray(collection.groupCollections)
        ) {
          collection.groupCollections.forEach((group: any) => {
            if (group.name && group.count) {
              processOrganization(group.name, group.count);
            }
          });
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
      organizationSandwichData.forEach((orgData, canonicalOrgName) => {
        // Find existing department entries for this organization using canonical matching
        let foundExisting = false;

        departmentsMap.forEach((dept, key) => {
          if (dept.canonicalName === canonicalOrgName) {
            foundExisting = true;
            dept.actualSandwichTotal = orgData.totalSandwiches;
            // Keep actualEventCount at event level (1 for completed, 0 for pending)
            // Don't overwrite with org-level counts for individual event cards
            dept.eventFrequency = calculateEventFrequency(orgData.eventDates);
            dept.hasHostedEvent = true;

            // Update latest collection date and calculate latest activity date
            const latestCollectionDate = Math.max(
              ...(Array.from(orgData.eventDates) as string[]).map((d) =>
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

        // Add as historical organization if not found in event requests
        if (!foundExisting) {
          const departmentKey = `${canonicalOrgName}|`; // Empty department for historical entries
          const latestCollectionDate = Math.max(
            ...(Array.from(orgData.eventDates) as string[]).map((d) => new Date(d).getTime())
          );

          const latestCollectionDateString = new Date(latestCollectionDate)
            .toISOString()
            .split('T')[0];

          departmentsMap.set(departmentKey, {
            organizationName: orgData.originalName,
            canonicalName: canonicalOrgName,
            department: '',
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
            eventDate: latestCollectionDateString, // Use collection date as event date
            latestCollectionDate: latestCollectionDateString,
          });
        }
      });

      // Initialize latestActivityDate for departments that don't have collection data
      departmentsMap.forEach((dept, key) => {
        if (!dept.latestActivityDate) {
          dept.latestActivityDate = dept.latestRequestDate;
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

        // Determine contact name label
        let contactNameLabel = 'Historical Organization';
        if (!dept.contacts || dept.contacts.length === 0) {
          // Check if latest collection date is in 2025 or later
          if (dept.latestCollectionDate) {
            const collectionYear = new Date(dept.latestCollectionDate).getFullYear();
            if (collectionYear >= 2025) {
              contactNameLabel = 'Collection Logged Only';
            }
          }
        }

        org.departments.push({
          organizationName: org.displayName, // Use unified display name
          department: dept.department,
          contactName: dept.contacts[0]?.name || contactNameLabel,
          email: dept.contacts[0]?.email || '',
          phone: dept.contacts[0]?.phone || '',
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
        });
      });

      // Convert to final format and sort
      const organizations = Array.from(organizationsMap.entries()).map(
        ([_, org]) => ({
          name: org.displayName,
          canonicalName: org.canonicalName,
          nameVariations: Array.from(org.nameVariations),
          departments: org.departments.sort(
            (a: any, b: any) =>
              new Date(b.latestActivityDate).getTime() -
              new Date(a.latestActivityDate).getTime()
          ),
        })
      );

      // Sort organizations by most recent activity across all departments
      organizations.sort((a, b) => {
        const aLatest = Math.max(
          ...a.departments.map((d: any) => new Date(d.latestActivityDate).getTime())
        );
        const bLatest = Math.max(
          ...b.departments.map((d: any) => new Date(d.latestActivityDate).getTime())
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

        // Get all event requests for this organization using canonical matching
        const eventRequests = await storage.getAllEventRequests();
        const orgEventRequests = eventRequests.filter(
          (request) =>
            canonicalizeOrgName(request.organizationName || '') ===
            canonicalSearchName
        );

        // Get all sandwich collections for this organization using canonical matching
        const allCollections = await storage.getAllSandwichCollections();
        const orgCollections = allCollections.filter((collection) => {
          // Check if organization name matches in any of the group fields using canonical names
          const matchesGroup1 =
            collection.group1Name &&
            canonicalizeOrgName(collection.group1Name) === canonicalSearchName;
          const matchesGroup2 =
            collection.group2Name &&
            canonicalizeOrgName(collection.group2Name) === canonicalSearchName;

          // Check JSON group collections using canonical names
          let matchesGroupCollections = false;
          if (
            collection.groupCollections &&
            Array.isArray(collection.groupCollections)
          ) {
            matchesGroupCollections = collection.groupCollections.some(
              (group: any) =>
                group.name &&
                canonicalizeOrgName(group.name) === canonicalSearchName
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
              : request.firstName || request.lastName || '',
          email: request.email,
          phone: request.phone,
          estimatedSandwiches: request.estimatedSandwichCount || 0,
          actualSandwiches: 0,
          notes: '',
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

  return router;
}

export default createGroupsCatalogRoutes;
