import type { EventRequest } from '@shared/schema';

// Format date for Excel display
const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format time for Excel display
const formatTime = (time: string | null | undefined): string => {
  if (!time) return '';
  return time;
};

// Format boolean for Excel display
const formatBoolean = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return value ? 'Yes' : 'No';
};

// Parse sandwich types for display
const formatSandwichTypes = (sandwichTypes: any): string => {
  if (!sandwichTypes) return '';
  try {
    const types = typeof sandwichTypes === 'string' ? JSON.parse(sandwichTypes) : sandwichTypes;
    if (Array.isArray(types)) {
      return types.map((t: { type: string; quantity: number }) => `${t.type}: ${t.quantity}`).join(', ');
    }
    return '';
  } catch {
    return '';
  }
};

// Base columns that apply to all event statuses
const getBaseColumns = () => [
  { header: 'ID', key: 'id' },
  { header: 'Organization', key: 'organizationName' },
  { header: 'Department', key: 'department' },
  { header: 'Category', key: 'organizationCategory' },
  { header: 'Contact First Name', key: 'firstName' },
  { header: 'Contact Last Name', key: 'lastName' },
  { header: 'Email', key: 'email' },
  { header: 'Phone', key: 'phone' },
];

// Column configurations by status/tab type
const columnConfigs: Record<string, Array<{ header: string; key: string; formatter?: (value: any, row: EventRequest) => string }>> = {
  new: [
    ...getBaseColumns(),
    { header: 'Requested Date', key: 'desiredEventDate', formatter: (v) => formatDate(v) },
    { header: 'Message', key: 'message' },
    { header: 'Previously Hosted', key: 'previouslyHosted' },
    { header: 'Created At', key: 'createdAt', formatter: (v) => formatDate(v) },
  ],

  in_process: [
    ...getBaseColumns(),
    { header: 'Requested Date', key: 'desiredEventDate', formatter: (v) => formatDate(v) },
    { header: 'Scheduled Date', key: 'scheduledEventDate', formatter: (v) => formatDate(v) },
    { header: 'Confirmed', key: 'isConfirmed', formatter: (v) => formatBoolean(v) },
    { header: 'TSP Contact', key: 'tspContactAssigned' },
    { header: 'Toolkit Sent', key: 'toolkitSent', formatter: (v) => formatBoolean(v) },
    { header: 'Event Address', key: 'eventAddress' },
    { header: 'Est. Sandwiches', key: 'estimatedSandwichCount' },
    { header: 'Planning Notes', key: 'planningNotes' },
  ],

  scheduled: [
    ...getBaseColumns(),
    { header: 'Scheduled Date', key: 'scheduledEventDate', formatter: (v) => formatDate(v) },
    { header: 'Confirmed', key: 'isConfirmed', formatter: (v) => formatBoolean(v) },
    { header: 'Event Start', key: 'eventStartTime' },
    { header: 'Event End', key: 'eventEndTime' },
    { header: 'Event Address', key: 'eventAddress' },
    { header: 'Est. Sandwiches', key: 'estimatedSandwichCount' },
    { header: 'Sandwich Types', key: 'sandwichTypes', formatter: (v) => formatSandwichTypes(v) },
    { header: 'Drivers Needed', key: 'driversNeeded' },
    { header: 'Self Transport', key: 'selfTransport', formatter: (v) => formatBoolean(v) },
    { header: 'Speakers Needed', key: 'speakersNeeded' },
    { header: 'Volunteers Needed', key: 'volunteersNeeded' },
    { header: 'Pickup Time', key: 'pickupTime' },
    { header: 'TSP Contact', key: 'tspContactAssigned' },
    { header: 'Delivery Destination', key: 'deliveryDestination' },
    { header: 'Overnight Location', key: 'overnightHoldingLocation' },
    { header: 'Refrigeration', key: 'hasRefrigeration', formatter: (v) => formatBoolean(v) },
    { header: 'Added to Sheet', key: 'addedToOfficialSheet', formatter: (v) => formatBoolean(v) },
    { header: 'Planning Notes', key: 'planningNotes' },
  ],

  completed: [
    ...getBaseColumns(),
    { header: 'Event Date', key: 'scheduledEventDate', formatter: (v) => formatDate(v) },
    { header: 'Event Address', key: 'eventAddress' },
    { header: 'Est. Sandwiches', key: 'estimatedSandwichCount' },
    { header: 'Actual Sandwiches', key: 'actualSandwichCount' },
    { header: 'Sandwich Types', key: 'sandwichTypes', formatter: (v) => formatSandwichTypes(v) },
    { header: 'Actual Types', key: 'actualSandwichTypes', formatter: (v) => formatSandwichTypes(v) },
    { header: 'Est. Attendance', key: 'estimatedAttendance' },
    { header: 'Actual Attendance', key: 'actualAttendance' },
    { header: 'Adults', key: 'attendanceAdults' },
    { header: 'Teens', key: 'attendanceTeens' },
    { header: 'Kids', key: 'attendanceKids' },
    { header: '1-Day Follow-up', key: 'followUpOneDayCompleted', formatter: (v) => formatBoolean(v) },
    { header: '1-Month Follow-up', key: 'followUpOneMonthCompleted', formatter: (v) => formatBoolean(v) },
    { header: 'Follow-up Notes', key: 'followUpNotes' },
    { header: 'TSP Contact', key: 'tspContactAssigned' },
  ],

  declined: [
    ...getBaseColumns(),
    { header: 'Requested Date', key: 'desiredEventDate', formatter: (v) => formatDate(v) },
    { header: 'Message', key: 'message' },
    { header: 'Status Changed', key: 'statusChangedAt', formatter: (v) => formatDate(v) },
    { header: 'Created At', key: 'createdAt', formatter: (v) => formatDate(v) },
  ],

  postponed: [
    ...getBaseColumns(),
    { header: 'Original Date', key: 'desiredEventDate', formatter: (v) => formatDate(v) },
    { header: 'Tentative New Date', key: 'tentativeNewDate', formatter: (v) => formatDate(v) },
    { header: 'Postponement Reason', key: 'postponementReason' },
    { header: 'Postponement Notes', key: 'postponementNotes' },
    { header: 'Status Changed', key: 'statusChangedAt', formatter: (v) => formatDate(v) },
    { header: 'Message', key: 'message' },
  ],

  my_assignments: [
    ...getBaseColumns(),
    { header: 'Status', key: 'status' },
    { header: 'Scheduled Date', key: 'scheduledEventDate', formatter: (v) => formatDate(v) },
    { header: 'Event Start', key: 'eventStartTime' },
    { header: 'Event Address', key: 'eventAddress' },
    { header: 'Pickup Time', key: 'pickupTime' },
    { header: 'Est. Sandwiches', key: 'estimatedSandwichCount' },
    { header: 'TSP Contact', key: 'tspContactAssigned' },
    { header: 'Planning Notes', key: 'planningNotes' },
  ],
};

// Export event requests to Excel
export async function exportEventRequestsToExcel(
  events: EventRequest[],
  tabType: string,
  filename?: string
): Promise<void> {
  // Dynamically import xlsx to avoid issues with React module loading
  const XLSX = await import('xlsx');

  // Get column configuration for this tab type
  const columns = columnConfigs[tabType] || columnConfigs.new;

  // Create worksheet data
  const headers = columns.map(col => col.header);
  const rows = events.map(event => {
    return columns.map(col => {
      const value = (event as any)[col.key];
      if (col.formatter) {
        return col.formatter(value, event);
      }
      if (value === null || value === undefined) return '';
      return String(value);
    });
  });

  // Create worksheet
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = columns.map((col) => {
    // Base width on header length and content
    const headerLen = col.header.length;
    const maxContentLen = Math.max(
      ...rows.map(row => String(row[columns.indexOf(col)] || '').length),
      0
    );
    return { wch: Math.min(Math.max(headerLen, maxContentLen, 10), 50) };
  });
  ws['!cols'] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Generate sheet name based on tab type
  const sheetNames: Record<string, string> = {
    new: 'New Requests',
    in_process: 'In Process',
    scheduled: 'Scheduled Events',
    completed: 'Completed Events',
    declined: 'Declined Requests',
    postponed: 'Postponed Events',
    my_assignments: 'My Assignments',
  };

  XLSX.utils.book_append_sheet(wb, ws, sheetNames[tabType] || 'Events');

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const defaultFilename = `event-requests-${tabType}-${dateStr}.xlsx`;

  // Write and download
  XLSX.writeFile(wb, filename || defaultFilename);
}

// Get status display text
export function getStatusDisplayName(status: string): string {
  const names: Record<string, string> = {
    new: 'New Requests',
    in_process: 'In Process',
    scheduled: 'Scheduled',
    completed: 'Completed',
    declined: 'Declined',
    postponed: 'Postponed',
    my_assignments: 'My Assignments',
  };
  return names[status] || status;
}
