/**
 * Integration tests for projects routes
 * Tests project CRUD operations with ownership-based permissions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { PERMISSIONS } from '../../../shared/auth-utils';
import {
  createTestServer,
  createTestUser,
  createAuthenticatedAgent,
  createAdminAgent,
} from '../../setup/test-server';

let app: express.Application;
let testUser: any;
let adminUser: any;
let authenticatedAgent: request.SuperAgentTest;
let adminAgent: request.SuperAgentTest;

describe('Projects Routes', () => {
  beforeAll(async () => {
    // Create test server
    app = await createTestServer();

    // Create test users
    testUser = await createTestUser({
      role: 'volunteer',
      permissions: [
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.PROJECTS_ADD,
        PERMISSIONS.PROJECTS_EDIT_OWN,
        PERMISSIONS.PROJECTS_DELETE_OWN,
      ],
    });

    adminUser = await createTestUser({
      role: 'admin',
      email: 'admin_projects@example.com',
    });

    // Create authenticated agents using the same user credentials
    authenticatedAgent = await createAuthenticatedAgent(app, {
      email: testUser.email,
      password: testUser.password,
    });

    adminAgent = await createAuthenticatedAgent(app, {
      email: adminUser.email,
      password: adminUser.password,
    });
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('GET /api/projects', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(401);
    });

    it('should return all projects for authenticated user', async () => {
      const response = await authenticatedAgent.get('/api/projects');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should include project metadata', async () => {
      const response = await authenticatedAgent.get('/api/projects');
      expect(response.status).toBe(200);

      if (response.body.length > 0) {
        const project = response.body[0];
        expect(project).toHaveProperty('id');
        expect(project).toHaveProperty('title');
        expect(project).toHaveProperty('status');
      }
    });
  });

  describe('GET /api/projects/for-review', () => {
    it('should return projects awaiting review', async () => {
      const response = await authenticatedAgent.get('/api/projects/for-review');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should only include projects with review status', async () => {
      const response = await authenticatedAgent.get('/api/projects/for-review');
      expect(response.status).toBe(200);

      response.body.forEach((project: any) => {
        expect(['for_review', 'pending_review', 'needs_review']).toContain(
          project.status
        );
      });
    });
  });

  describe('GET /api/projects/archived', () => {
    it('should return archived projects', async () => {
      const response = await authenticatedAgent.get('/api/projects/archived');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should only include archived projects', async () => {
      const response = await authenticatedAgent.get('/api/projects/archived');
      expect(response.status).toBe(200);

      response.body.forEach((project: any) => {
        expect(project.status).toBe('archived');
      });
    });
  });

  describe('POST /api/projects', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          title: 'Test Project',
          description: 'Test description',
        });

      expect(response.status).toBe(401);
    });

    it('should create project with valid data', async () => {
      const newProject = {
        title: 'New Project',
        description: 'Project description',
        status: 'pending',
        priority: 'medium',
        category: 'development',
      };

      const response = await authenticatedAgent
        .post('/api/projects')
        .send(newProject);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: 'New Project',
        description: 'Project description',
        status: 'pending',
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdBy).toBe(testUser.id);
    });

    it('should validate required fields', async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          description: 'Missing title',
        });

      expect(response.status).toBe(400);
    });

    it('should set default values correctly', async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Simple Project',
          description: 'Simple description',
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('should allow assigning to specific users', async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Assigned Project',
          description: 'Assigned to admin',
          assigneeIds: [adminUser.id],
        });

      expect(response.status).toBe(201);
      expect(response.body.assigneeIds).toContain(adminUser.id);
    });
  });

  describe('GET /api/projects/:id', () => {
    let testProject: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Test Project',
          description: 'Test description',
          status: 'pending',
        });
      testProject = response.body;
    });

    it('should return project by ID', async () => {
      const response = await authenticatedAgent.get(`/api/projects/${testProject.id}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testProject.id);
      expect(response.body.title).toBe('Test Project');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authenticatedAgent.get('/api/projects/999999');
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid ID', async () => {
      const response = await authenticatedAgent.get('/api/projects/invalid-id');
      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    let testProject: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Test Project',
          description: 'Test description',
          status: 'pending',
        });
      testProject = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch(`/api/projects/${testProject.id}`)
        .send({ status: 'in_progress' });

      expect(response.status).toBe(401);
    });

    it('should allow owner to update own project', async () => {
      const response = await authenticatedAgent
        .patch(`/api/projects/${testProject.id}`)
        .send({ status: 'in_progress' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in_progress');
    });

    it('should allow admin to update any project with EDIT_ALL permission', async () => {
      const response = await adminAgent
        .patch(`/api/projects/${testProject.id}`)
        .send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    it('should allow updating multiple fields', async () => {
      const response = await authenticatedAgent
        .patch(`/api/projects/${testProject.id}`)
        .send({
          title: 'Updated Title',
          description: 'Updated description',
          status: 'in_progress',
          priority: 'high',
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.description).toBe('Updated description');
      expect(response.body.priority).toBe('high');
    });

    it('should deny non-owner/non-assignee without EDIT_ALL permission', async () => {
      // Create project as admin
      const adminProject = await adminAgent
        .post('/api/projects')
        .send({
          title: 'Admin Project',
          description: 'Admin only',
        });

      // Try to edit with regular user (should fail)
      const response = await authenticatedAgent
        .patch(`/api/projects/${adminProject.body.id}`)
        .send({ status: 'completed' });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authenticatedAgent
        .patch('/api/projects/999999')
        .send({ status: 'completed' });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:id', () => {
    let testProject: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Test Project',
          description: 'Test description',
          status: 'pending',
        });
      testProject = response.body;
    });

    it('should require PROJECTS_EDIT_ALL permission', async () => {
      const response = await authenticatedAgent
        .put(`/api/projects/${testProject.id}`)
        .send({
          title: 'Fully Updated',
          description: 'Full update',
          status: 'completed',
        });

      expect(response.status).toBe(403);
    });

    it('should allow full update with EDIT_ALL permission', async () => {
      const response = await adminAgent
        .put(`/api/projects/${testProject.id}`)
        .send({
          title: 'Fully Updated',
          description: 'Full update',
          status: 'completed',
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Fully Updated');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    let testProject: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'To Delete Project',
          description: 'Will be deleted',
        });
      testProject = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app).delete(`/api/projects/${testProject.id}`);
      expect(response.status).toBe(401);
    });

    it('should allow owner to delete own project', async () => {
      const response = await authenticatedAgent.delete(`/api/projects/${testProject.id}`);
      expect(response.status).toBe(204);
    });

    it('should deny non-owner without DELETE_ALL permission', async () => {
      // Create admin project
      const adminProject = await adminAgent
        .post('/api/projects')
        .send({
          title: 'Admin Project',
          description: 'Admin only',
        });

      // Try to delete with regular user
      const response = await authenticatedAgent.delete(
        `/api/projects/${adminProject.body.id}`
      );

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authenticatedAgent.delete('/api/projects/999999');
      expect(response.status).toBe(404);
    });

    it('should actually remove project from database', async () => {
      await authenticatedAgent.delete(`/api/projects/${testProject.id}`);

      const getResponse = await authenticatedAgent.get(`/api/projects/${testProject.id}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/claim', () => {
    let unclaimedProject: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/projects')
        .send({
          title: 'Unclaimed Project',
          description: 'Available for claiming',
          status: 'pending',
        });
      unclaimedProject = response.body;
    });

    it('should allow user to claim a project', async () => {
      const response = await authenticatedAgent
        .post(`/api/projects/${unclaimedProject.id}/claim`)
        .send({
          assigneeName: `${testUser.firstName} ${testUser.lastName}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.assigneeNames).toContain(
        `${testUser.firstName} ${testUser.lastName}`
      );
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authenticatedAgent
        .post('/api/projects/999999/claim')
        .send({ assigneeName: 'Test User' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/archive', () => {
    let completedProject: any;

    beforeEach(async () => {
      const createResponse = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Completed Project',
          description: 'Ready to archive',
          status: 'completed',
        });
      completedProject = createResponse.body;
    });

    it('should require authentication', async () => {
      const response = await request(app).post(
        `/api/projects/${completedProject.id}/archive`
      );
      expect(response.status).toBe(401);
    });

    it('should archive completed project', async () => {
      const response = await authenticatedAgent.post(
        `/api/projects/${completedProject.id}/archive`
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('archived successfully');
    });

    it('should not allow archiving non-completed projects', async () => {
      const pendingProject = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Pending Project',
          description: 'Not ready to archive',
          status: 'pending',
        });

      const response = await authenticatedAgent.post(
        `/api/projects/${pendingProject.body.id}/archive`
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('completed');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authenticatedAgent.post('/api/projects/999999/archive');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:id/tasks', () => {
    let testProject: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Project with Tasks',
          description: 'Has tasks',
        });
      testProject = response.body;
    });

    it('should return tasks for a project', async () => {
      const response = await authenticatedAgent.get(
        `/api/projects/${testProject.id}/tasks`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 400 for invalid project ID', async () => {
      const response = await authenticatedAgent.get('/api/projects/invalid/tasks');
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/projects/:id/tasks', () => {
    let testProject: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Project for Tasks',
          description: 'Will have tasks',
        });
      testProject = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/tasks`)
        .send({
          title: 'New Task',
          description: 'Task description',
        });

      expect(response.status).toBe(401);
    });

    it('should create task for project', async () => {
      const response = await authenticatedAgent
        .post(`/api/projects/${testProject.id}/tasks`)
        .send({
          title: 'New Task',
          description: 'Task description',
          status: 'pending',
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Task');
      expect(response.body.projectId).toBe(testProject.id);
    });

    it('should validate task data', async () => {
      const response = await authenticatedAgent
        .post(`/api/projects/${testProject.id}/tasks`)
        .send({
          // Missing title
          description: 'Task without title',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/projects/:id/files', () => {
    let testProject: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/projects')
        .send({
          title: 'Project with Files',
          description: 'Has files',
        });
      testProject = response.body;
    });

    it('should return files for a project', async () => {
      const response = await authenticatedAgent.get(
        `/api/projects/${testProject.id}/files`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 400 for invalid project ID', async () => {
      const response = await authenticatedAgent.get('/api/projects/invalid/files');
      expect(response.status).toBe(400);
    });
  });
});
