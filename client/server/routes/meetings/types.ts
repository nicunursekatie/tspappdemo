import type {
  User,
  Committee,
  CommitteeMembership,
  MeetingMinutes,
  InsertMeetingMinutes,
  DriveLink,
  AgendaItem,
  InsertAgendaItem,
  Meeting,
  InsertMeeting,
  MeetingNote,
  InsertMeetingNote,
} from '@shared/schema';

// Interface Segregation: Only include storage methods used by meetings module
export interface IMeetingsStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserCommittees(userId: string): Promise<Array<Committee & { membership: CommitteeMembership }>>;
  
  // Meeting Minutes methods
  getAllMeetingMinutes(): Promise<MeetingMinutes[]>;
  getRecentMeetingMinutes(limit: number): Promise<MeetingMinutes[]>;
  createMeetingMinutes(minutes: InsertMeetingMinutes): Promise<MeetingMinutes>;
  deleteMeetingMinutes(id: number): Promise<boolean>;
  
  // Drive Links methods
  getAllDriveLinks(): Promise<DriveLink[]>;
  
  // Agenda Items methods
  getAllAgendaItems(): Promise<AgendaItem[]>;
  createAgendaItem(item: InsertAgendaItem): Promise<AgendaItem>;
  updateAgendaItemStatus(id: number, status: string): Promise<AgendaItem | undefined>;
  updateAgendaItem(id: number, updates: Partial<AgendaItem>): Promise<AgendaItem | undefined>;
  deleteAgendaItem(id: number): Promise<boolean>;
  
  // Meetings methods
  getCurrentMeeting(): Promise<Meeting | undefined>;
  getAllMeetings(): Promise<Meeting[]>;
  getMeetingsByType(type: string): Promise<Meeting[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeetingAgenda(id: number, agenda: string): Promise<Meeting | undefined>;
  updateMeeting(id: number, updates: Partial<Meeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: number): Promise<boolean>;
  
  // Meeting Notes methods
  getAllMeetingNotes(): Promise<MeetingNote[]>;
  getMeetingNote(id: number): Promise<MeetingNote | undefined>;
  getMeetingNotesByFilters(filters: {
    projectId?: number;
    meetingId?: number;
    type?: string;
    status?: string;
  }): Promise<MeetingNote[]>;
  createMeetingNote(note: InsertMeetingNote): Promise<MeetingNote>;
  updateMeetingNote(id: number, updates: Partial<MeetingNote>): Promise<MeetingNote | undefined>;
  deleteMeetingNote(id: number): Promise<boolean>;
}
