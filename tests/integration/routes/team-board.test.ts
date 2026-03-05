/**
 * Integration tests for team-board routes
 * Tests team board task management functionality
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

describe('Team Board Routes', () => {
  beforeAll(async () => {
    // Create test server
    app = await createTestServer();

    // Create test users
    testUser = await createTestUser({
      role: 'volunteer',
      permissions: [
        PERMISSIONS.TEAM_BOARD_VIEW,
        PERMISSIONS.TEAM_BOARD_ADD,
        PERMISSIONS.TEAM_BOARD_EDIT,
      ],
    });

    adminUser = await createTestUser({
      role: 'admin',
      email: 'admin_teamboard@example.com',
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

  describe('GET /api/team-board/items', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/team-board/items');
      expect(response.status).toBe(401);
    });

    it('should return team board items for authenticated user', async () => {
      const response = await authenticatedAgent.get('/api/team-board/items');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support filtering by status', async () => {
      const response = await authenticatedAgent
        .get('/api/team-board/items')
        .query({ status: 'pending' });

      expect(response.status).toBe(200);
      response.body.forEach((item: any) => {
        expect(item.status).toBe('pending');
      });
    });

    it('should support filtering by category', async () => {
      const response = await authenticatedAgent
        .get('/api/team-board/items')
        .query({ category: 'task' });

      expect(response.status).toBe(200);
      response.body.forEach((item: any) => {
        expect(item.category).toBe('task');
      });
    });

    it('should support filtering by assigned user', async () => {
      const response = await authenticatedAgent
        .get('/api/team-board/items')
        .query({ assignedTo: testUser.id });

      expect(response.status).toBe(200);
      response.body.forEach((item: any) => {
        expect(item.assignedTo).toBe(testUser.id);
      });
    });
  });

  describe('POST /api/team-board/items', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/team-board/items')
        .send({
          title: 'New Task',
          description: 'Task description',
          category: 'task',
        });

      expect(response.status).toBe(401);
    });

    it('should create a team board item with valid data', async () => {
      const newItem = {
        title: 'New Task',
        description: 'Task description',
        category: 'task',
        status: 'pending',
        priority: 'medium',
      };

      const response = await authenticatedAgent
        .post('/api/team-board/items')
        .send(newItem);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: 'New Task',
        description: 'Task description',
        category: 'task',
        status: 'pending',
        priority: 'medium',
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdBy).toBe(testUser.id);
    });

    it('should validate required fields', async () => {
      const response = await authenticatedAgent
        .post('/api/team-board/items')
        .send({
          description: 'Missing title',
        });

      expect(response.status).toBe(400);
    });

    it('should validate category values', async () => {
      const response = await authenticatedAgent
        .post('/api/team-board/items')
        .send({
          title: 'Task',
          category: 'invalid-category',
        });

      expect(response.status).toBe(400);
    });

    it('should validate status values', async () => {
      const response = await authenticatedAgent
        .post('/api/team-board/items')
        .send({
          title: 'Task',
          category: 'task',
          status: 'invalid-status',
        });

      expect(response.status).toBe(400);
    });

    it('should set default status if not provided', async () => {
      const response = await authenticatedAgent
        .post('/api/team-board/items')
        .send({
          title: 'Task',
          description: 'Description',
          category: 'task',
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBeDefined();
    });
  });

  describe('PATCH /api/team-board/items/:id', () => {
    let testItem: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/team-board/items')
        .send({
          title: 'Test Task',
          description: 'Test description',
          category: 'task',
          status: 'pending',
        });
      testItem = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch(`/api/team-board/items/${testItem.id}`)
        .send({ status: 'in_progress' });

      expect(response.status).toBe(401);
    });

    it('should update team board item', async () => {
      const response = await authenticatedAgent
        .patch(`/api/team-board/items/${testItem.id}`)
        .send({ status: 'in_progress' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in_progress');
    });

    it('should allow updating multiple fields', async () => {
      const response = await authenticatedAgent
        .patch(`/api/team-board/items/${testItem.id}`)
        .send({
          status: 'completed',
          priority: 'high',
          assignedTo: adminUser.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
      expect(response.body.priority).toBe('high');
      expect(response.body.assignedTo).toBe(adminUser.id);
    });

    it('should validate updated values', async () => {
      const response = await authenticatedAgent
        .patch(`/api/team-board/items/${testItem.id}`)
        .send({ status: 'invalid-status' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await authenticatedAgent
        .patch('/api/team-board/items/999999')
        .send({ status: 'completed' });

      expect(response.status).toBe(404);
    });

    it('should update updatedAt timestamp', async () => {
      const originalTimestamp = testItem.updatedAt;

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await authenticatedAgent
        .patch(`/api/team-board/items/${testItem.id}`)
        .send({ status: 'in_progress' });

      expect(response.status).toBe(200);
      expect(response.body.updatedAt).not.toBe(originalTimestamp);
    });
  });

  describe('DELETE /api/team-board/items/:id', () => {
    let testItem: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/team-board/items')
        .send({
          title: 'Test Task',
          description: 'Test description',
          category: 'task',
          status: 'pending',
        });
      testItem = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app).delete(`/api/team-board/items/${testItem.id}`);
      expect(response.status).toBe(401);
    });

    it('should delete team board item', async () => {
      const response = await authenticatedAgent.delete(`/api/team-board/items/${testItem.id}`);
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await authenticatedAgent.delete('/api/team-board/items/999999');
      expect(response.status).toBe(404);
    });

    it('should actually remove item from database', async () => {
      await authenticatedAgent.delete(`/api/team-board/items/${testItem.id}`);

      const allItems = await authenticatedAgent.get('/api/team-board/items');
      const deletedItem = allItems.body.find((item: any) => item.id === testItem.id);
      expect(deletedItem).toBeUndefined();
    });
  });

  describe('POST /api/team-board/items/:id/claim', () => {
    let unclaimedItem: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/team-board/items')
        .send({
          title: 'Unclaimed Task',
          description: 'Available for claiming',
          category: 'task',
          status: 'pending',
        });
      unclaimedItem = response.body;
    });

    it('should allow user to claim an item', async () => {
      const response = await authenticatedAgent.post(
        `/api/team-board/items/${unclaimedItem.id}/claim`
      );

      expect(response.status).toBe(200);
      expect(response.body.assignedTo).toBe(testUser.id);
      expect(response.body.status).toBe('in_progress');
    });

    it('should not allow claiming already assigned item', async () => {
      // Claim it first
      await authenticatedAgent.post(`/api/team-board/items/${unclaimedItem.id}/claim`);

      // Try to claim again with different user
      const response = await adminAgent.post(
        `/api/team-board/items/${unclaimedItem.id}/claim`
      );

      expect(response.status).toBe(409); // Conflict
    });

    it('should return 404 for non-existent item', async () => {
      const response = await authenticatedAgent.post('/api/team-board/items/999999/claim');
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/team-board/items/:id/unclaim', () => {
    let claimedItem: any;

    beforeEach(async () => {
      const createResponse = await authenticatedAgent
        .post('/api/team-board/items')
        .send({
          title: 'Claimed Task',
          description: 'Task to unclaim',
          category: 'task',
          status: 'pending',
        });

      claimedItem = createResponse.body;

      // Claim it
      await authenticatedAgent.post(`/api/team-board/items/${claimedItem.id}/claim`);
    });

    it('should allow user to unclaim their own item', async () => {
      const response = await authenticatedAgent.post(
        `/api/team-board/items/${claimedItem.id}/unclaim`
      );

      expect(response.status).toBe(200);
      expect(response.body.assignedTo).toBeNull();
      expect(response.body.status).toBe('pending');
    });

    it('should not allow unclaiming others items without permission', async () => {
      const response = await adminAgent.post(
        `/api/team-board/items/${claimedItem.id}/unclaim`
      );

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await authenticatedAgent.post('/api/team-board/items/999999/unclaim');
      expect(response.status).toBe(404);
    });
  });
});
