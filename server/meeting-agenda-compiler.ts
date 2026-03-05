import type { Meeting, AgendaItem, Project } from '@shared/schema';
import type { DatabaseStorage } from './database-storage';

interface CompiledAgendaSection {
  title: string;
  orderIndex: number;
  items: AgendaItemWithDetails[];
}

interface AgendaItemWithDetails {
  id?: number;
  title: string;
  description?: string;
  submittedBy: string;
  type: 'agenda_item' | 'project_review' | 'deferred_item';
  status?: string;
  projectId?: number;
  estimatedTime?: string;
}

interface CompiledAgenda {
  meetingId: number;
  title: string;
  date: string;
  sections: CompiledAgendaSection[];
  deferredItems: AgendaItemWithDetails[];
  totalEstimatedTime?: string;
}

export class MeetingAgendaCompiler {
  constructor(private storage: DatabaseStorage) {}

  /**
   * Compile a comprehensive agenda for a meeting
   * Includes: agenda items + projects marked for review + deferred items
   */
  async compileAgenda(
    meetingId: number,
    compiledBy: string
  ): Promise<CompiledAgenda> {
    const meeting = await this.storage.getMeeting(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // Get all agenda items for this meeting
    const agendaItems = await this.storage.getAgendaItemsByMeeting(meetingId);

    // Get projects marked for review in next meeting
    const projectsForReview = await this.storage.getProjectsForReview();

    // Get deferred items from previous meeting
    const deferredItems = await this.getDeferredItemsFromPreviousMeeting(
      meeting.type
    );

    // Create the four required sections
    const sections: CompiledAgendaSection[] = [
      {
        title: 'Old Business',
        orderIndex: 1,
        items: this.buildOldBusinessItems(deferredItems, agendaItems),
      },
      {
        title: 'Urgent Items',
        orderIndex: 2,
        items: this.buildUrgentItems(agendaItems, projectsForReview),
      },
      {
        title: 'Housekeeping',
        orderIndex: 3,
        items: this.buildHousekeepingItems(agendaItems),
      },
      {
        title: 'New Business',
        orderIndex: 4,
        items: this.buildNewBusinessItems(agendaItems, projectsForReview),
      },
    ];

    // Calculate total estimated time
    const totalEstimatedTime = this.calculateTotalTime(sections);

    return {
      meetingId,
      title: `${meeting.title} - ${meeting.date}`,
      date: meeting.date,
      sections,
      deferredItems: [], // Items that weren't addressed
      totalEstimatedTime,
    };
  }

  /**
   * Build Old Business section - deferred items and follow-ups
   */
  private buildOldBusinessItems(
    deferredItems: AgendaItemWithDetails[],
    agendaItems: AgendaItem[]
  ): AgendaItemWithDetails[] {
    const items: AgendaItemWithDetails[] = [];

    // Add deferred items from previous meeting
    items.push(...deferredItems);

    // Add agenda items specifically marked as "old business" or "follow-up"
    const oldBusinessItems = agendaItems
      .filter(
        (item) =>
          item.status === 'approved' &&
          (item.title.toLowerCase().includes('follow-up') ||
            item.title.toLowerCase().includes('old business') ||
            item.description?.toLowerCase().includes('follow-up'))
      )
      .map((item) => this.convertAgendaItemToDetails(item));

    items.push(...oldBusinessItems);
    return items;
  }

  /**
   * Build Urgent Items section - high priority items and critical projects
   */
  private buildUrgentItems(
    agendaItems: AgendaItem[],
    projectsForReview: Project[]
  ): AgendaItemWithDetails[] {
    const items: AgendaItemWithDetails[] = [];

    // Add urgent agenda items
    const urgentAgendaItems = agendaItems
      .filter(
        (item) =>
          item.status === 'approved' &&
          (item.title.toLowerCase().includes('urgent') ||
            item.title.toLowerCase().includes('critical') ||
            item.description?.toLowerCase().includes('urgent'))
      )
      .map((item) => this.convertAgendaItemToDetails(item, '5 min'));

    items.push(...urgentAgendaItems);

    // Add high priority projects for review
    const urgentProjects = projectsForReview
      .filter(
        (project) => project.priority === 'high' || project.priority === 'P0'
      )
      .map((project) => this.convertProjectToAgendaItem(project, '10 min'));

    items.push(...urgentProjects);
    return items;
  }

  /**
   * Build Housekeeping section - administrative and routine items
   */
  private buildHousekeepingItems(
    agendaItems: AgendaItem[]
  ): AgendaItemWithDetails[] {
    const housekeepingKeywords = [
      'housekeeping',
      'admin',
      'administrative',
      'routine',
      'schedule',
      'logistics',
      'reminder',
      'announcement',
      'update',
    ];

    return agendaItems
      .filter((item) => {
        if (item.status !== 'approved') return false;

        const text = `${item.title} ${item.description}`.toLowerCase();
        return housekeepingKeywords.some((keyword) => text.includes(keyword));
      })
      .map((item) => this.convertAgendaItemToDetails(item, '3 min'));
  }

  /**
   * Build New Business section - new projects and general agenda items
   */
  private buildNewBusinessItems(
    agendaItems: AgendaItem[],
    projectsForReview: Project[]
  ): AgendaItemWithDetails[] {
    const items: AgendaItemWithDetails[] = [];

    // Add regular approved agenda items (not already categorized)
    const newBusinessItems = agendaItems
      .filter((item) => {
        if (item.status !== 'approved') return false;

        const text = `${item.title} ${item.description}`.toLowerCase();
        const isOldBusiness =
          text.includes('follow-up') || text.includes('old business');
        const isUrgent = text.includes('urgent') || text.includes('critical');
        const isHousekeeping = [
          'housekeeping',
          'admin',
          'routine',
          'schedule',
        ].some((k) => text.includes(k));

        return !isOldBusiness && !isUrgent && !isHousekeeping;
      })
      .map((item) => this.convertAgendaItemToDetails(item, '8 min'));

    items.push(...newBusinessItems);

    // Add medium/low priority projects for review
    const newBusinessProjects = projectsForReview
      .filter((project) => !['high', 'P0'].includes(project.priority || ''))
      .map((project) => this.convertProjectToAgendaItem(project, '15 min'));

    items.push(...newBusinessProjects);
    return items;
  }

  /**
   * Convert AgendaItem to AgendaItemWithDetails
   */
  private convertAgendaItemToDetails(
    item: AgendaItem,
    estimatedTime: string = '5 min'
  ): AgendaItemWithDetails {
    return {
      id: item.id,
      title: item.title,
      description: item.description || '',
      submittedBy: item.submittedBy,
      type: 'agenda_item',
      status: item.status,
      estimatedTime,
    };
  }

  /**
   * Convert Project to AgendaItemWithDetails
   */
  private convertProjectToAgendaItem(
    project: Project,
    estimatedTime: string = '10 min'
  ): AgendaItemWithDetails {
    return {
      title: `Project Review: ${project.title}`,
      description: `Status: ${project.status}. ${project.description || ''}`,
      submittedBy: project.createdByName || project.createdBy || 'System',
      type: 'project_review',
      projectId: project.id,
      estimatedTime,
    };
  }

  /**
   * Get deferred items from the most recent meeting of the same type
   */
  private async getDeferredItemsFromPreviousMeeting(
    meetingType: string
  ): Promise<AgendaItemWithDetails[]> {
    // This would fetch from the previous compiled agenda's deferredItems
    // For now, return empty array - can be enhanced later
    return [];
  }

  /**
   * Calculate total estimated meeting time
   */
  private calculateTotalTime(sections: CompiledAgendaSection[]): string {
    let totalMinutes = 0;

    sections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.estimatedTime) {
          const minutes = parseInt(item.estimatedTime.replace(/\D/g, '')) || 5;
          totalMinutes += minutes;
        }
      });
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Save compiled agenda to database
   */
  async saveCompiledAgenda(
    agenda: CompiledAgenda,
    compiledBy: string
  ): Promise<number> {
    const compiledAgendaId = await this.storage.createCompiledAgenda({
      meetingId: agenda.meetingId,
      title: agenda.title,
      date: agenda.date,
      status: 'draft',
      sections: agenda.sections,
      deferredItems: agenda.deferredItems,
      compiledBy,
    });

    // Save individual sections
    for (const section of agenda.sections) {
      await this.storage.createAgendaSection({
        compiledAgendaId,
        title: section.title,
        orderIndex: section.orderIndex,
        items: section.items,
      });
    }

    return compiledAgendaId;
  }

  /**
   * Export agenda to Google Sheets format
   */
  async exportToGoogleSheets(compiledAgendaId: number): Promise<any[]> {
    const agenda = await this.storage.getCompiledAgenda(compiledAgendaId);
    if (!agenda) {
      throw new Error('Compiled agenda not found');
    }

    const sheetData: any[] = [];

    // Header
    sheetData.push([agenda.title]);
    sheetData.push([`Date: ${agenda.date}`]);
    sheetData.push(['']); // Empty row

    // Sections
    agenda.sections.forEach((section) => {
      sheetData.push([section.title]);
      sheetData.push(['Item', 'Description', 'Presenter', 'Time']);

      section.items.forEach((item) => {
        sheetData.push([
          item.title,
          item.description || '',
          item.submittedBy,
          item.estimatedTime || '5 min',
        ]);
      });

      sheetData.push(['']); // Empty row between sections
    });

    return sheetData;
  }
}
