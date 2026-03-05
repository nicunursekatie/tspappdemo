/**
 * Assignment Services
 *
 * Provides services for managing assignments across the platform:
 * - Project assignments (owners and support people)
 * - Task assignments (assignees and reviewers)
 * - Team board assignments
 * - Meeting-project relationships
 */

import {
  ProjectAssignmentService,
  type IProjectAssignmentService,
  type AssignmentUser,
} from './project-assignment-service';

import {
  TaskAssignmentService,
  type ITaskAssignmentService,
  type TaskAssignmentUser,
} from './task-assignment-service';

import {
  TeamBoardAssignmentService,
  type ITeamBoardAssignmentService,
  type TeamBoardAssignmentUser,
} from './team-board-assignment-service';

import {
  MeetingProjectService,
  type IMeetingProjectService,
  type MeetingProjectData,
} from './meeting-project-service';

// Re-export types and classes
export type {
  IProjectAssignmentService,
  AssignmentUser,
  ITaskAssignmentService,
  TaskAssignmentUser,
  ITeamBoardAssignmentService,
  TeamBoardAssignmentUser,
  IMeetingProjectService,
  MeetingProjectData,
};

export {
  ProjectAssignmentService,
  TaskAssignmentService,
  TeamBoardAssignmentService,
  MeetingProjectService,
};

// Create singleton instances for easy import
export const projectAssignmentService = new ProjectAssignmentService();
export const taskAssignmentService = new TaskAssignmentService();
export const teamBoardAssignmentService = new TeamBoardAssignmentService();
export const meetingProjectService = new MeetingProjectService();
