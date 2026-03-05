import type { EventRequest } from '@shared/schema';

/**
 * Detects critical issues for scheduled events approaching their date
 * Returns an array of issue messages that should be flagged
 */
export function detectScheduledEventIssues(event: EventRequest, daysUntilEvent?: number): string[] {
  const issues: string[] = [];
  
  // Calculate days until event if not provided
  if (daysUntilEvent === undefined) {
    const eventDate = event.scheduledEventDate || event.desiredEventDate;
    if (!eventDate) return issues;
    
    const now = new Date();
    const eventDateObj = new Date(eventDate);
    const diffTime = eventDateObj.getTime() - now.getTime();
    daysUntilEvent = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  // Only check for issues if event is within 14 days
  if (daysUntilEvent > 14 || daysUntilEvent < 0) {
    return issues;
  }
  
  // Critical: Missing event start time
  if (!event.eventStartTime) {
    issues.push('Missing event start time - needed for scheduling');
  }
  
  // Critical: Missing event end time
  if (!event.eventEndTime) {
    issues.push('Missing event end time - needed for planning');
  }
  
  // Critical: Missing pickup time (if drivers are needed)
  if ((event.driversNeeded && event.driversNeeded > 0) || event.vanDriverNeeded) {
    if (!event.pickupTime && !event.pickupDateTime) {
      issues.push('Missing pickup time - drivers need this information');
    }
  }
  
  // Critical: Unable to contact organizer (check last contact attempt)
  if (event.contactAttemptsLog && Array.isArray(event.contactAttemptsLog)) {
    const recentAttempts = event.contactAttemptsLog.filter((attempt: any) => {
      const attemptDate = new Date(attempt.timestamp);
      const daysSinceAttempt = Math.floor((Date.now() - attemptDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceAttempt <= 3; // Within last 3 days
    });
    
    // If there are recent attempts but all failed/unresponsive
    const failedAttempts = recentAttempts.filter((attempt: any) => 
      attempt.outcome?.toLowerCase().includes('no answer') ||
      attempt.outcome?.toLowerCase().includes('unresponsive') ||
      attempt.outcome?.toLowerCase().includes('voicemail') ||
      attempt.outcome?.toLowerCase().includes('no response')
    );
    
    if (recentAttempts.length > 0 && failedAttempts.length === recentAttempts.length) {
      issues.push('Unable to contact organizer - multiple recent attempts unsuccessful');
    }
  } else if (event.isUnresponsive) {
    issues.push('Organizer marked as unresponsive - needs attention');
  }
  
  // Critical: Missing address (if delivery is needed)
  if ((event.driversNeeded && event.driversNeeded > 0) || event.vanDriverNeeded) {
    if (!event.eventAddress && !event.deliveryDestination && !event.overnightHoldingLocation) {
      issues.push('Missing delivery address - drivers cannot deliver without this');
    }
  }
  
  // Important: Missing sandwich count
  if (!event.estimatedSandwichCount && 
      !event.estimatedSandwichCountMin && 
      !event.estimatedSandwichCountMax) {
    issues.push('Missing estimated sandwich count - needed for planning');
  }
  
  // Important: Event not confirmed (within 7 days)
  if (daysUntilEvent <= 7 && !event.isConfirmed) {
    issues.push('Event date not confirmed - verify with organizer');
  }
  
  return issues;
}

/**
 * Auto-creates pre-event flags for critical issues
 * Returns flags that should be added to the event
 */
export function autoCreatePreEventFlags(
  event: EventRequest,
  userId: string,
  userName: string
): Array<{
  type: 'critical' | 'important' | 'attention';
  message: string;
}> {
  const issues = detectScheduledEventIssues(event);
  const flags: Array<{ type: 'critical' | 'important' | 'attention'; message: string }> = [];
  
  // Check if flags already exist for these issues (to avoid duplicates)
  const existingFlags = (event.preEventFlags || []).filter((f: any) => !f.resolvedAt);
  const existingMessages = existingFlags.map((f: any) => f.message.toLowerCase());
  
  issues.forEach(issue => {
    // Don't create duplicate flags
    if (existingMessages.some((msg: string) => msg.includes(issue.toLowerCase().substring(0, 20)))) {
      return;
    }
    
    // Determine flag type based on issue severity
    let type: 'critical' | 'important' | 'attention' = 'important';
    if (issue.includes('Missing') && (issue.includes('start time') || issue.includes('pickup time') || issue.includes('address'))) {
      type = 'critical';
    } else if (issue.includes('Unable to contact') || issue.includes('unresponsive')) {
      type = 'critical';
    } else if (issue.includes('not confirmed')) {
      type = 'important';
    }
    
    flags.push({
      type,
      message: issue,
    });
  });
  
  return flags;
}

