import OpenAI from 'openai';
import type { EventRequest } from '@shared/schema';
import { logger } from '../../utils/production-safe-logger';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Validation rule severity levels
export type ValidationSeverity = 'critical' | 'warning' | 'suggestion';

// Validation rule category for organization
export type ValidationCategory =
  | 'scheduling'
  | 'logistics'
  | 'sandwiches'
  | 'contact'
  | 'verification'
  | 'general';

// Individual validation issue
export interface ValidationIssue {
  category: ValidationCategory;
  severity: ValidationSeverity;
  field: string;
  title: string;
  message: string;
  suggestion?: string;
  action?: string; // What the coordinator should do
}

// Extensible validation rule definition
export interface ValidationRule {
  id: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  check: (eventRequest: EventRequest, context: ValidationContext) => ValidationIssue | null;
}

// Context for validation (additional data needed for checks)
export interface ValidationContext {
  scheduledEvents: EventRequest[];
  hasHostedBefore?: boolean;
}

// AI assistant response structure
export interface AiIntakeAssistance {
  overallStatus: 'complete' | 'needs_attention' | 'critical_missing';
  completionPercentage: number;
  criticalIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
  aiRecommendations?: string; // Optional AI-generated recommendations
  nextSteps: string[];
}

// Extensible validation rules registry
const VALIDATION_RULES: ValidationRule[] = [
  // CRITICAL: Refrigeration
  {
    id: 'refrigeration_required',
    category: 'logistics',
    severity: 'critical',
    check: (event) => {
      if (event.hasRefrigeration === null || event.hasRefrigeration === undefined) {
        return {
          category: 'logistics',
          severity: 'critical',
          field: 'hasRefrigeration',
          title: 'Refrigeration Information Missing',
          message: 'We need to know if the organization has refrigeration available.',
          suggestion: 'Ask if they have access to refrigerators to store sandwiches before the event.',
          action: 'Get confirmation about refrigeration availability'
        };
      }
      return null;
    }
  },

  // CRITICAL: Event Date
  {
    id: 'event_date_required',
    category: 'scheduling',
    severity: 'critical',
    check: (event) => {
      if (!event.scheduledEventDate && !event.desiredEventDate) {
        return {
          category: 'scheduling',
          severity: 'critical',
          field: 'scheduledEventDate',
          title: 'Event Date Missing',
          message: 'No event date has been specified or confirmed.',
          suggestion: 'Work with the organization to confirm a specific event date.',
          action: 'Confirm event date with organization'
        };
      }
      return null;
    }
  },

  // CRITICAL: Event Times
  {
    id: 'event_times_required',
    category: 'scheduling',
    severity: 'critical',
    check: (event) => {
      const hasDate = event.scheduledEventDate || event.desiredEventDate;
      const hasEventTimes = event.eventStartTime && event.eventEndTime;
      const hasPickupTime = event.pickupTime;
      
      // If we have a date, we need either event times OR pickup time (either is acceptable)
      if (hasDate && !hasEventTimes && !hasPickupTime) {
        return {
          category: 'scheduling',
          severity: 'critical',
          field: 'eventStartTime',
          title: 'Event Times Missing',
          message: 'Either event start/end times OR a pickup time is required for scheduling.',
          suggestion: 'Ask for either the event times (start and end) or the pickup time for sandwiches.',
          action: 'Get event times or pickup time'
        };
      }
      return null;
    }
  },

  // WARNING: Date Scheduling Conflicts
  {
    id: 'date_scheduling_conflict',
    category: 'scheduling',
    severity: 'warning',
    check: (event, context) => {
      const targetDate = event.scheduledEventDate || event.desiredEventDate;
      if (!targetDate) return null;

      const eventDate = new Date(targetDate);
      const weekStart = getWeekStart(eventDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // Count events in the same week
      const eventsInWeek = context.scheduledEvents.filter(e => {
        if (!e.scheduledEventDate || e.id === event.id) return false;
        const scheduledDate = new Date(e.scheduledEventDate);
        return scheduledDate >= weekStart && scheduledDate < weekEnd;
      });

      if (eventsInWeek.length >= 3) {
        return {
          category: 'scheduling',
          severity: 'warning',
          field: 'scheduledEventDate',
          title: 'Busy Week Detected',
          message: `This week already has ${eventsInWeek.length} events scheduled. Consider spreading events across weeks when possible.`,
          suggestion: 'Check if there are alternative dates with fewer scheduled events.',
          action: 'Review alternative dates or confirm this date works'
        };
      }
      return null;
    }
  },

  // CRITICAL: Sandwich Count
  {
    id: 'sandwich_count_required',
    category: 'sandwiches',
    severity: 'critical',
    check: (event) => {
      if (!event.estimatedSandwichCount || event.estimatedSandwichCount === 0) {
        return {
          category: 'sandwiches',
          severity: 'critical',
          field: 'estimatedSandwichCount',
          title: 'Sandwich Count Missing',
          message: 'We need to know how many sandwiches they plan to make.',
          suggestion: 'Ask for a specific sandwich count commitment.',
          action: 'Get estimated sandwich count'
        };
      }
      return null;
    }
  },

  // SUGGESTION: Encourage More Sandwiches
  {
    id: 'sandwich_count_minimum',
    category: 'sandwiches',
    severity: 'suggestion',
    check: (event) => {
      const count = event.estimatedSandwichCount || 0;
      if (count > 0 && count < 200) {
        return {
          category: 'sandwiches',
          severity: 'suggestion',
          field: 'estimatedSandwichCount',
          title: 'Encourage Higher Production',
          message: `Current count is ${count} sandwiches (minimum threshold). Consider encouraging them to make more if they have capacity.`,
          suggestion: 'Ask if they have the volunteers and resources to make more than the minimum 200 sandwiches.',
          action: 'Encourage making more sandwiches if possible'
        };
      }
      return null;
    }
  },

  // CRITICAL: Sandwich Types
  {
    id: 'sandwich_types_required',
    category: 'sandwiches',
    severity: 'critical',
    check: (event) => {
      const types = event.sandwichTypes;
      if (!Array.isArray(types) || types.length === 0) {
        return {
          category: 'sandwiches',
          severity: 'critical',
          field: 'sandwichTypes',
          title: 'Sandwich Types Missing',
          message: 'We need to know what types of sandwiches they will make.',
          suggestion: 'Ask them to specify sandwich types (preferably turkey or other deli meat).',
          action: 'Get specific sandwich types and quantities'
        };
      }
      return null;
    }
  },

  // SUGGESTION: Prefer Deli Meat (Turkey)
  {
    id: 'prefer_deli_meat',
    category: 'sandwiches',
    severity: 'suggestion',
    check: (event) => {
      // Check structured sandwich types field
      const types = event.sandwichTypes as any;
      let hasDeli = false;
      let hasTurkey = false;
      
      if (types && Array.isArray(types) && types.length > 0) {
        hasDeli = types.some((t: any) =>
          ['turkey', 'ham', 'roast beef', 'chicken', 'deli'].some(meat =>
            t.type?.toLowerCase().includes(meat)
          )
        );

        hasTurkey = types.some((t: any) =>
          t.type?.toLowerCase().includes('turkey')
        );
      }
      
      // Also check notes fields for mentions of deli meats (case insensitive)
      const notesFields = [
        event.planningNotes,
        event.schedulingNotes,
        event.additionalRequirements,
        event.message
      ].filter(Boolean).join(' ').toLowerCase();
      
      if (notesFields) {
        if (!hasDeli && /(turkey|ham|roast beef|chicken|deli)/i.test(notesFields)) {
          hasDeli = true;
        }
        if (!hasTurkey && /turkey/i.test(notesFields)) {
          hasTurkey = true;
        }
      }
      
      // Only suggest if NO deli meat detected anywhere
      if (!hasDeli) {
        return {
          category: 'sandwiches',
          severity: 'suggestion',
          field: 'sandwichTypes',
          title: 'Encourage Deli Meat Sandwiches',
          message: 'No deli meat sandwiches detected. We prefer turkey or other deli meats when possible.',
          suggestion: 'Ask if they can make turkey or other deli meat sandwiches instead of or in addition to PBJ.',
          action: 'Encourage deli meat sandwiches (preferably turkey)'
        };
      } else if (!hasTurkey) {
        return {
          category: 'sandwiches',
          severity: 'suggestion',
          field: 'sandwichTypes',
          title: 'Turkey Preferred',
          message: 'Turkey sandwiches are our top preference when available.',
          suggestion: 'If they\'re flexible, suggest turkey as the preferred option.',
          action: 'Consider suggesting turkey as preferred option'
        };
      }

      return null;
    }
  },

  // WARNING: Excessive PBJ
  {
    id: 'excessive_pbj',
    category: 'sandwiches',
    severity: 'warning',
    check: (event) => {
      const types = event.sandwichTypes as any;
      if (!types || !Array.isArray(types) || types.length === 0) return null;

      const pbjSandwich = types.find((t: any) =>
        t.type?.toLowerCase().includes('pbj') ||
        t.type?.toLowerCase().includes('peanut butter')
      );

      if (pbjSandwich && pbjSandwich.quantity >= 500) {
        return {
          category: 'sandwiches',
          severity: 'warning',
          field: 'sandwichTypes',
          title: 'High PBJ Count',
          message: `${pbjSandwich.quantity} PBJ sandwiches is quite high. We rarely want 500+ PBJ sandwiches.`,
          suggestion: 'Ask if they can make deli meat sandwiches instead of some of the PBJ sandwiches.',
          action: 'Discuss reducing PBJ count in favor of deli meat'
        };
      }

      return null;
    }
  },

  // CRITICAL: Event Address
  {
    id: 'event_address_required',
    category: 'logistics',
    severity: 'critical',
    check: (event) => {
      if (!event.eventAddress || event.eventAddress.trim() === '') {
        return {
          category: 'logistics',
          severity: 'critical',
          field: 'eventAddress',
          title: 'Event Address Missing',
          message: 'We need the event location address for logistics planning.',
          suggestion: 'Get the full address where the sandwich-making event will take place.',
          action: 'Get complete event address'
        };
      }
      return null;
    }
  },

  // CRITICAL: Previous Hosting History
  {
    id: 'previous_hosting_required',
    category: 'verification',
    severity: 'critical',
    check: (event) => {
      if (!event.previouslyHosted || event.previouslyHosted === 'i_dont_know') {
        return {
          category: 'verification',
          severity: 'critical',
          field: 'previouslyHosted',
          title: 'Previous Hosting History Unknown',
          message: 'We need to know if this organization has made sandwiches for us before.',
          suggestion: 'Check if they have participated in The Sandwich Project before.',
          action: 'Verify if organization has hosted before'
        };
      }
      return null;
    }
  },

  // WARNING: New Organization Drop-off Policy
  {
    id: 'new_org_dropoff_policy',
    category: 'verification',
    severity: 'warning',
    check: (event, context) => {
      const isNew = event.previouslyHosted === 'no';
      const hasDeliveryDestination = event.deliveryDestination && event.deliveryDestination.trim() !== '';

      if (isNew && hasDeliveryDestination) {
        return {
          category: 'verification',
          severity: 'warning',
          field: 'deliveryDestination',
          title: 'New Organization - Quality Check Required',
          message: 'This is a new organization. A team member should inspect sandwiches before delivery to recipients.',
          suggestion: 'Arrange for a team member to see the sandwiches before they go to the recipient.',
          action: 'Schedule quality inspection for new organization'
        };
      }

      return null;
    }
  },

  // SUGGESTION: Contact Information
  {
    id: 'contact_info_complete',
    category: 'contact',
    severity: 'suggestion',
    check: (event) => {
      const missingFields = [];
      if (!event.firstName || !event.lastName) missingFields.push('contact name');
      if (!event.email && !event.phone) missingFields.push('contact method (email or phone)');

      if (missingFields.length > 0) {
        return {
          category: 'contact',
          severity: 'suggestion',
          field: 'contact',
          title: 'Contact Information Incomplete',
          message: `Missing: ${missingFields.join(', ')}`,
          suggestion: 'Complete contact information helps with follow-up and coordination.',
          action: 'Get complete contact information'
        };
      }

      return null;
    }
  },

  // CRITICAL: Driver Needs Assessment (for scheduled events)
  {
    id: 'driver_needs_assessment',
    category: 'logistics',
    severity: 'critical',
    check: (event) => {
      // Only check for scheduled events
      if (event.status !== 'scheduled') return null;
      
      if (event.driversNeeded === null || event.driversNeeded === undefined) {
        return {
          category: 'logistics',
          severity: 'critical',
          field: 'driversNeeded',
          title: 'Driver Needs Not Assessed',
          message: 'For scheduled events, we need to know how many drivers are required.',
          suggestion: 'Determine if drivers are needed based on delivery destination and sandwich count.',
          action: 'Assess driver needs and update the event'
        };
      }
      return null;
    }
  },

  // WARNING: Drivers Needed But Not Assigned
  {
    id: 'drivers_needed_not_assigned',
    category: 'logistics',
    severity: 'warning',
    check: (event) => {
      // Only check for scheduled events
      if (event.status !== 'scheduled') return null;
      
      const driversNeeded = event.driversNeeded || 0;
      const assignedDrivers = event.assignedDriverIds?.length || 0;
      
      if (driversNeeded > 0 && assignedDrivers === 0) {
        return {
          category: 'logistics',
          severity: 'warning',
          field: 'assignedDriverIds',
          title: `${driversNeeded} Driver${driversNeeded > 1 ? 's' : ''} Needed - None Assigned`,
          message: `This event needs ${driversNeeded} driver${driversNeeded > 1 ? 's' : ''} but none have been assigned yet.`,
          suggestion: 'Assign drivers to this event to ensure sandwiches can be delivered.',
          action: `Assign ${driversNeeded} driver${driversNeeded > 1 ? 's' : ''} to this event`
        };
      } else if (driversNeeded > assignedDrivers) {
        return {
          category: 'logistics',
          severity: 'warning',
          field: 'assignedDriverIds',
          title: `More Drivers Needed`,
          message: `This event needs ${driversNeeded} drivers but only ${assignedDrivers} assigned.`,
          suggestion: 'Assign additional drivers to meet the requirement.',
          action: `Assign ${driversNeeded - assignedDrivers} more driver${driversNeeded - assignedDrivers > 1 ? 's' : ''}`
        };
      }
      
      return null;
    }
  },

  // CRITICAL: Speaker Needs Assessment (for scheduled events)
  {
    id: 'speaker_needs_assessment',
    category: 'logistics',
    severity: 'critical',
    check: (event) => {
      // Only check for scheduled events
      if (event.status !== 'scheduled') return null;
      
      if (event.speakersNeeded === null || event.speakersNeeded === undefined) {
        return {
          category: 'logistics',
          severity: 'critical',
          field: 'speakersNeeded',
          title: 'Speaker Needs Not Assessed',
          message: 'For scheduled events, we need to know if speakers are required.',
          suggestion: 'Determine if the organization wants a speaker for their event.',
          action: 'Assess speaker needs and update the event'
        };
      }
      return null;
    }
  },

  // WARNING: Speakers Needed But Not Assigned
  {
    id: 'speakers_needed_not_assigned',
    category: 'logistics',
    severity: 'warning',
    check: (event) => {
      // Only check for scheduled events
      if (event.status !== 'scheduled') return null;
      
      const speakersNeeded = event.speakersNeeded || 0;
      const assignedSpeakers = event.assignedSpeakerIds?.length || 0;
      
      if (speakersNeeded > 0 && assignedSpeakers === 0) {
        return {
          category: 'logistics',
          severity: 'warning',
          field: 'assignedSpeakerIds',
          title: `${speakersNeeded} Speaker${speakersNeeded > 1 ? 's' : ''} Needed - None Assigned`,
          message: `This event needs ${speakersNeeded} speaker${speakersNeeded > 1 ? 's' : ''} but none have been assigned yet.`,
          suggestion: 'Assign speakers to this event.',
          action: `Assign ${speakersNeeded} speaker${speakersNeeded > 1 ? 's' : ''} to this event`
        };
      } else if (speakersNeeded > assignedSpeakers) {
        return {
          category: 'logistics',
          severity: 'warning',
          field: 'assignedSpeakerIds',
          title: `More Speakers Needed`,
          message: `This event needs ${speakersNeeded} speakers but only ${assignedSpeakers} assigned.`,
          suggestion: 'Assign additional speakers to meet the requirement.',
          action: `Assign ${speakersNeeded - assignedSpeakers} more speaker${speakersNeeded - assignedSpeakers > 1 ? 's' : ''}`
        };
      }
      
      return null;
    }
  },

  // SUGGESTION: Volunteer Needs Assessment
  {
    id: 'volunteer_needs_assessment',
    category: 'logistics',
    severity: 'suggestion',
    check: (event) => {
      // Only check for scheduled events
      if (event.status !== 'scheduled') return null;
      
      if (event.volunteersNeeded === null || event.volunteersNeeded === undefined) {
        return {
          category: 'logistics',
          severity: 'suggestion',
          field: 'volunteersNeeded',
          title: 'Volunteer Needs Not Assessed',
          message: 'Consider whether additional volunteers are needed for this event.',
          suggestion: 'Check if the organization needs extra volunteers to help with the event.',
          action: 'Assess if additional volunteers are needed'
        };
      }
      return null;
    }
  },
];

/**
 * Gets the Monday of the week for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Run all validation rules against an event request
 */
export function runValidationRules(
  eventRequest: EventRequest,
  context: ValidationContext
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const rule of VALIDATION_RULES) {
    try {
      const issue = rule.check(eventRequest, context);
      if (issue) {
        issues.push(issue);
      }
    } catch (error) {
      logger.error(`Validation rule ${rule.id} failed`, error);
    }
  }

  return issues;
}

/**
 * Main AI intake assistant function
 * Provides comprehensive analysis and suggestions for intake coordinators
 */
export async function analyzeEventRequest(
  eventRequest: EventRequest,
  allScheduledEvents: EventRequest[]
): Promise<AiIntakeAssistance> {
  // Build validation context
  const context: ValidationContext = {
    scheduledEvents: allScheduledEvents,
    hasHostedBefore: eventRequest.previouslyHosted === 'yes'
  };

  // Run all validation rules
  const allIssues = runValidationRules(eventRequest, context);

  // Categorize issues by severity
  const criticalIssues = allIssues.filter(i => i.severity === 'critical');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const suggestions = allIssues.filter(i => i.severity === 'suggestion');

  // Calculate completion percentage
  const totalRules = VALIDATION_RULES.filter(r => r.severity === 'critical').length;
  const passedRules = totalRules - criticalIssues.length;
  const completionPercentage = Math.round((passedRules / totalRules) * 100);

  // Determine overall status
  let overallStatus: 'complete' | 'needs_attention' | 'critical_missing';
  if (criticalIssues.length > 0) {
    overallStatus = 'critical_missing';
  } else if (warnings.length > 0 || suggestions.length > 0) {
    overallStatus = 'needs_attention';
  } else {
    overallStatus = 'complete';
  }

  // Generate next steps
  const nextSteps = generateNextSteps(criticalIssues, warnings, suggestions);

  // Try to get AI-enhanced recommendations
  let aiRecommendations: string | undefined;
  try {
    aiRecommendations = await generateAiRecommendations(
      eventRequest,
      criticalIssues,
      warnings,
      suggestions
    );
  } catch (error) {
    logger.error('Failed to generate AI recommendations', error);
    // Continue without AI recommendations
  }

  return {
    overallStatus,
    completionPercentage,
    criticalIssues,
    warnings,
    suggestions,
    aiRecommendations,
    nextSteps
  };
}

/**
 * Generate prioritized next steps based on issues
 */
function generateNextSteps(
  critical: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): string[] {
  const steps: string[] = [];

  // Add critical actions first
  critical.forEach(issue => {
    if (issue.action) {
      steps.push(issue.action);
    }
  });

  // Add warning actions
  warnings.forEach(issue => {
    if (issue.action) {
      steps.push(issue.action);
    }
  });

  // Add up to 3 suggestion actions
  suggestions.slice(0, 3).forEach(issue => {
    if (issue.action) {
      steps.push(issue.action);
    }
  });

  // If no issues, provide general guidance
  if (steps.length === 0) {
    steps.push('All critical information collected');
    steps.push('Review event details and confirm with organization');
    steps.push('Schedule follow-up if needed');
  }

  return steps;
}

/**
 * Use AI to generate contextual recommendations
 */
async function generateAiRecommendations(
  eventRequest: EventRequest,
  critical: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): Promise<string> {
  // Skip AI if no API key configured
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error('AI API key not configured');
  }

  const prompt = buildAiPrompt(eventRequest, critical, warnings, suggestions);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an AI assistant for The Sandwich Project intake coordinators. Your role is to help ensure all necessary information is collected from organizations hosting sandwich-making events.

Be concise, actionable, and supportive. Focus on what the coordinator should do next to complete the intake process. Your tone should be helpful and professional.

IMPORTANT WORKFLOW RULES:
• Recipient Assignment: NEVER suggest contacting the organization to find recipients. The Sandwich Project staff handles recipient matching internally through networking and research. If a recipient is needed, suggest "Research and identify recipient organizations near [location]" directed at TSP staff, not the organization contact.
• Organization Contact: Only suggest contacting the organization for information they would know (event details, sandwich count, timing, etc.), NOT for TSP internal logistics like finding recipients.

Provide 2-3 specific, actionable recommendations based on the current state of the event request. Format your response as a bulleted list using "•" as the bullet character, with one recommendation per line.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  return completion.choices[0].message.content || '';
}

/**
 * Build prompt for AI recommendations
 */
function buildAiPrompt(
  eventRequest: EventRequest,
  critical: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): string {
  const orgInfo = `
Organization: ${eventRequest.organizationName || 'Not specified'}
Contact: ${eventRequest.firstName || ''} ${eventRequest.lastName || ''}
Status: ${eventRequest.status}
${eventRequest.estimatedSandwichCount ? `Estimated Sandwiches: ${eventRequest.estimatedSandwichCount}` : ''}
${eventRequest.scheduledEventDate ? `Scheduled Date: ${new Date(eventRequest.scheduledEventDate).toLocaleDateString()}` : ''}
${eventRequest.eventStartTime && eventRequest.eventEndTime ? `Event Time: ${eventRequest.eventStartTime} - ${eventRequest.eventEndTime}` : ''}
${eventRequest.eventAddress ? `Address: ${eventRequest.eventAddress}` : ''}
`.trim();

  // Collect all notes fields
  const notesFields = [
    eventRequest.message ? `Initial Request: ${eventRequest.message}` : null,
    eventRequest.planningNotes ? `Planning Notes: ${eventRequest.planningNotes}` : null,
    eventRequest.schedulingNotes ? `Scheduling Notes: ${eventRequest.schedulingNotes}` : null,
    eventRequest.additionalRequirements ? `Additional Requirements: ${eventRequest.additionalRequirements}` : null,
    eventRequest.volunteerNotes ? `Volunteer Notes: ${eventRequest.volunteerNotes}` : null,
    eventRequest.driverNotes ? `Driver Notes: ${eventRequest.driverNotes}` : null,
    eventRequest.vanDriverNotes ? `Van Driver Notes: ${eventRequest.vanDriverNotes}` : null,
    eventRequest.followUpNotes ? `Follow-up Notes: ${eventRequest.followUpNotes}` : null,
  ].filter(Boolean);

  const notesSection = notesFields.length > 0 ? `

Notes and Comments:
${notesFields.join('\n')}

IMPORTANT: Review the notes above for any unstructured information about driver needs, speaker requests, volunteer requirements, or logistics that should have been captured in dedicated fields but weren't. Flag these if found.` : '';

  const issuesSummary = `
Critical Issues (${critical.length}): ${critical.length > 0 ? critical.map(i => i.title).join(', ') : 'None'}
Warnings (${warnings.length}): ${warnings.length > 0 ? warnings.map(i => i.title).join(', ') : 'None'}
Suggestions (${suggestions.length}): ${suggestions.length > 0 ? suggestions.map(i => i.title).join(', ') : 'None'}
`.trim();

  return `${orgInfo}${notesSection}

${issuesSummary}

What should the intake coordinator focus on next to complete this event request? Provide specific, actionable recommendations. If the notes contain any information about drivers, speakers, volunteers, or logistics that weren't properly captured in structured fields, flag that.`;
}

/**
 * Add a new validation rule to the registry
 * This allows for dynamic expansion of validation rules
 */
export function registerValidationRule(rule: ValidationRule): void {
  // Check if rule already exists
  const existingIndex = VALIDATION_RULES.findIndex(r => r.id === rule.id);

  if (existingIndex >= 0) {
    // Replace existing rule
    VALIDATION_RULES[existingIndex] = rule;
    logger.log(`Updated validation rule: ${rule.id}`);
  } else {
    // Add new rule
    VALIDATION_RULES.push(rule);
    logger.log(`Registered new validation rule: ${rule.id}`);
  }
}

/**
 * Get all registered validation rules
 * Useful for configuration and management
 */
export function getValidationRules(): ValidationRule[] {
  return [...VALIDATION_RULES];
}
