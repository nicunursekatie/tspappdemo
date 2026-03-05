/**
 * Integration tests for collections routes
 * Tests collection CRUD operations with permission checking
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { PERMISSIONS } from '../../../shared/auth-utils';
import {
  createTestServer,
  createTestUser,
  createAuthenticatedAgent,
} from '../../setup/test-server';

// This will be populated by setup
let app: express.Application;
let testUser: Record<string, unknown>;
let adminUser: Record<string, unknown>;
let noPermissionsUser: Record<string, unknown>;
let authenticatedAgent: request.SuperAgentTest;
let adminAgent: request.SuperAgentTest;
let noPermissionsAgent: request.SuperAgentTest;

describe('Collections Routes', () => {
  beforeAll(async () => {
    // Create test server
    app = await createTestServer();

    // Create test users with appropriate permissions
    testUser = await createTestUser({
      role: 'volunteer',
      permissions: [
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.COLLECTIONS_ADD,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_DELETE_OWN,
      ],
    });

    // Create admin user first, then create agent with same credentials
    adminUser = await createTestUser({
      role: 'admin',
      email: 'admin_collections@example.com',
    });

    // Create user with no permissions for testing authorization
    noPermissionsUser = await createTestUser({
      role: 'viewer',
      permissions: [], // No permissions
    });

    // Create authenticated agents
    authenticatedAgent = await createAuthenticatedAgent(app, {
      email: testUser.email,
      password: testUser.password,
    });

    adminAgent = await createAuthenticatedAgent(app, {
      email: adminUser.email,
      password: adminUser.password,
    });

    noPermissionsAgent = await createAuthenticatedAgent(app, {
      email: noPermissionsUser.email,
      password: noPermissionsUser.password,
    });
  });

  beforeEach(() => {
    // Reset any state between tests
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('GET /api/collections', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/collections');
      expect(response.status).toBe(401);
    });

    it('should return collections for authenticated user with permission', async () => {
      const response = await authenticatedAgent.get('/api/collections');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should deny access for user without COLLECTIONS_VIEW permission', async () => {
      // Use authenticated agent for user with no collection permissions
      const response = await noPermissionsAgent.get('/api/collections');

      expect(response.status).toBe(403);
    });

    it('should support pagination', async () => {
      const response = await authenticatedAgent
        .get('/api/collections')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support filtering by date range', async () => {
      const response = await authenticatedAgent
        .get('/api/collections')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/collections', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/collections')
        .send({
          hostId: 1,
          collectionDate: '2025-10-25',
          sandwichesCollected: 100,
        });

      expect(response.status).toBe(401);
    });

    it('should create collection with valid data and permissions', async () => {
      const newCollection = {
        hostId: 1,
        collectionDate: '2025-10-25',
        sandwichesCollected: 100,
        notes: 'Test collection',
      };

      const response = await authenticatedAgent
        .post('/api/collections')
        .send(newCollection);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        hostId: 1,
        sandwichesCollected: 100,
      });
      expect(response.body.id).toBeDefined();
    });

    it('should deny access without COLLECTIONS_ADD permission', async () => {
      const response = await noPermissionsAgent
        .post('/api/collections')
        .send({
          hostId: 1,
          collectionDate: '2025-10-25',
          sandwichesCollected: 100,
        });

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const response = await authenticatedAgent
        .post('/api/collections')
        .send({
          // Missing required fields
          notes: 'Invalid collection',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('validation');
    });

    it('should validate data types', async () => {
      const response = await authenticatedAgent
        .post('/api/collections')
        .send({
          hostId: 'not-a-number',
          collectionDate: '2025-10-25',
          sandwichesCollected: 'not-a-number',
        });

      expect(response.status).toBe(400);
    });

    it('should set createdBy to current user', async () => {
      const response = await authenticatedAgent
        .post('/api/collections')
        .send({
          hostId: 1,
          collectionDate: '2025-10-25',
          sandwichesCollected: 50,
        });

      expect(response.status).toBe(201);
      expect(response.body.createdBy).toBe(testUser.id);
    });
  });

  describe('PATCH /api/collections/:id', () => {
    let testCollection: Record<string, unknown>;

    beforeEach(async () => {
      // Create a test collection
      const response = await authenticatedAgent
        .post('/api/collections')
        .send({
          hostId: 1,
          collectionDate: '2025-10-25',
          sandwichesCollected: 100,
        });
      testCollection = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch(`/api/collections/${testCollection.id}`)
        .send({ sandwichesCollected: 150 });

      expect(response.status).toBe(401);
    });

    it('should allow owner to edit own collection with EDIT_OWN permission', async () => {
      const response = await authenticatedAgent
        .patch(`/api/collections/${testCollection.id}`)
        .send({ sandwichesCollected: 150 });

      expect(response.status).toBe(200);
      expect(response.body.sandwichesCollected).toBe(150);
    });

    it('should allow admin to edit any collection with EDIT_ALL permission', async () => {
      const response = await adminAgent
        .patch(`/api/collections/${testCollection.id}`)
        .send({ sandwichesCollected: 200 });

      expect(response.status).toBe(200);
      expect(response.body.sandwichesCollected).toBe(200);
    });

    it('should deny non-owner without EDIT_ALL permission', async () => {
      // Create a different user's collection
      const otherCollection = await adminAgent
        .post('/api/collections')
        .send({
          hostId: 2,
          collectionDate: '2025-10-26',
          sandwichesCollected: 75,
        });

      // Try to edit it with regular user (should fail)
      const response = await authenticatedAgent
        .patch(`/api/collections/${otherCollection.body.id}`)
        .send({ sandwichesCollected: 100 });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await authenticatedAgent
        .patch('/api/collections/999999')
        .send({ sandwichesCollected: 150 });

      expect(response.status).toBe(404);
    });

    it('should validate updated data', async () => {
      const response = await authenticatedAgent
        .patch(`/api/collections/${testCollection.id}`)
        .send({ sandwichesCollected: -50 }); // Negative value

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/collections/:id', () => {
    let testCollection: Record<string, unknown>;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/collections')
        .send({
          hostId: 1,
          collectionDate: '2025-10-25',
          sandwichesCollected: 100,
        });
      testCollection = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app).delete(`/api/collections/${testCollection.id}`);
      expect(response.status).toBe(401);
    });

    it('should allow owner to delete own collection with DELETE_OWN permission', async () => {
      const response = await authenticatedAgent.delete(`/api/collections/${testCollection.id}`);
      expect(response.status).toBe(200);
    });

    it('should allow admin to delete any collection with DELETE_ALL permission', async () => {
      const response = await adminAgent.delete(`/api/collections/${testCollection.id}`);
      expect(response.status).toBe(200);
    });

    it('should deny non-owner without DELETE_ALL permission', async () => {
      const otherCollection = await adminAgent
        .post('/api/collections')
        .send({
          hostId: 2,
          collectionDate: '2025-10-26',
          sandwichesCollected: 75,
        });

      const response = await authenticatedAgent.delete(
        `/api/collections/${otherCollection.body.id}`
      );
      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await authenticatedAgent.delete('/api/collections/999999');
      expect(response.status).toBe(404);
    });

    it('should actually remove the collection from database', async () => {
      await authenticatedAgent.delete(`/api/collections/${testCollection.id}`);

      const getResponse = await authenticatedAgent.get(
        `/api/collections/${testCollection.id}`
      );
      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET /api/collections/stats', () => {
    it('should return collection statistics', async () => {
      const response = await authenticatedAgent.get('/api/collections/stats');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalCollections');
      expect(response.body).toHaveProperty('totalSandwiches');
    });

    it('should support date range filtering', async () => {
      const response = await authenticatedAgent
        .get('/api/collections/stats')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        });

      expect(response.status).toBe(200);
      expect(typeof response.body.totalCollections).toBe('number');
    });
  });
});
