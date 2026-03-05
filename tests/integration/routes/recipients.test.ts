/**
 * Integration tests for recipients routes
 * Tests recipient organization management functionality
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

describe('Recipients Routes', () => {
  beforeAll(async () => {
    // Create test server
    app = await createTestServer();

    // Create test users
    testUser = await createTestUser({
      role: 'volunteer',
      permissions: [
        PERMISSIONS.RECIPIENTS_VIEW,
        PERMISSIONS.RECIPIENTS_ADD,
        PERMISSIONS.RECIPIENTS_EDIT,
      ],
    });

    adminUser = await createTestUser({
      role: 'admin',
      email: 'admin_recipients@example.com',
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

  describe('GET /api/recipients', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/recipients');
      expect(response.status).toBe(401);
    });

    it('should return recipients for user with RECIPIENTS_VIEW permission', async () => {
      const response = await authenticatedAgent.get('/api/recipients');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should deny access without RECIPIENTS_VIEW permission', async () => {
      const response = await request(app)
        .get('/api/recipients')
        .set('Cookie', ['session=no-permission']);

      expect(response.status).toBe(403);
    });

    it('should support filtering by active status', async () => {
      const response = await authenticatedAgent
        .get('/api/recipients')
        .query({ active: true });

      expect(response.status).toBe(200);
      response.body.forEach((recipient: any) => {
        expect(recipient.isActive).toBe(true);
      });
    });

    it('should support search by organization name', async () => {
      const response = await authenticatedAgent
        .get('/api/recipients')
        .query({ search: 'Food Bank' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return recipient details including contact information', async () => {
      const response = await authenticatedAgent.get('/api/recipients');
      expect(response.status).toBe(200);

      if (response.body.length > 0) {
        const recipient = response.body[0];
        expect(recipient).toHaveProperty('organizationName');
        expect(recipient).toHaveProperty('contactName');
        expect(recipient).toHaveProperty('contactEmail');
      }
    });
  });

  describe('POST /api/recipients', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/recipients')
        .send({
          organizationName: 'New Organization',
          contactName: 'John Doe',
          contactEmail: 'john@example.com',
        });

      expect(response.status).toBe(401);
    });

    it('should require RECIPIENTS_ADD permission', async () => {
      const response = await request(app)
        .post('/api/recipients')
        .set('Cookie', ['session=no-add-permission'])
        .send({
          organizationName: 'New Organization',
          contactName: 'John Doe',
          contactEmail: 'john@example.com',
        });

      expect(response.status).toBe(403);
    });

    it('should create recipient with valid data', async () => {
      const newRecipient = {
        organizationName: 'Community Food Bank',
        contactName: 'Jane Smith',
        contactEmail: 'jane@foodbank.org',
        contactPhone: '555-0123',
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
      };

      const response = await adminAgent
        .post('/api/recipients')
        .send(newRecipient);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        organizationName: 'Community Food Bank',
        contactName: 'Jane Smith',
        contactEmail: 'jane@foodbank.org',
      });
      expect(response.body.id).toBeDefined();
    });

    it('should validate required fields', async () => {
      const response = await adminAgent
        .post('/api/recipients')
        .send({
          contactName: 'John Doe',
          // Missing organizationName
        });

      expect(response.status).toBe(400);
    });

    it('should validate email format', async () => {
      const response = await adminAgent
        .post('/api/recipients')
        .send({
          organizationName: 'Test Org',
          contactName: 'John Doe',
          contactEmail: 'invalid-email',
        });

      expect(response.status).toBe(400);
    });

    it('should prevent duplicate organization names', async () => {
      const recipient = {
        organizationName: 'Unique Org Name',
        contactName: 'Jane Smith',
        contactEmail: 'jane@unique.org',
      };

      // Create first recipient
      await adminAgent.post('/api/recipients').send(recipient);

      // Try to create duplicate
      const response = await adminAgent.post('/api/recipients').send(recipient);

      expect(response.status).toBe(409); // Conflict
    });

    it('should set default isActive to true', async () => {
      const response = await adminAgent
        .post('/api/recipients')
        .send({
          organizationName: 'Active Org',
          contactName: 'John Doe',
          contactEmail: 'john@active.org',
        });

      expect(response.status).toBe(201);
      expect(response.body.isActive).toBe(true);
    });
  });

  describe('PATCH /api/recipients/:id', () => {
    let testRecipient: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/recipients')
        .send({
          organizationName: 'Test Organization',
          contactName: 'Test Contact',
          contactEmail: 'test@org.com',
        });
      testRecipient = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch(`/api/recipients/${testRecipient.id}`)
        .send({ contactName: 'Updated Name' });

      expect(response.status).toBe(401);
    });

    it('should require RECIPIENTS_EDIT permission', async () => {
      const response = await request(app)
        .patch(`/api/recipients/${testRecipient.id}`)
        .set('Cookie', ['session=no-edit-permission'])
        .send({ contactName: 'Updated Name' });

      expect(response.status).toBe(403);
    });

    it('should update recipient with valid data', async () => {
      const response = await adminAgent
        .patch(`/api/recipients/${testRecipient.id}`)
        .send({
          contactName: 'Updated Contact',
          contactPhone: '555-9999',
        });

      expect(response.status).toBe(200);
      expect(response.body.contactName).toBe('Updated Contact');
      expect(response.body.contactPhone).toBe('555-9999');
    });

    it('should allow updating multiple fields', async () => {
      const response = await adminAgent
        .patch(`/api/recipients/${testRecipient.id}`)
        .send({
          organizationName: 'Updated Org',
          contactEmail: 'updated@org.com',
          address: '456 New St',
          isActive: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.organizationName).toBe('Updated Org');
      expect(response.body.contactEmail).toBe('updated@org.com');
      expect(response.body.isActive).toBe(false);
    });

    it('should validate email format on update', async () => {
      const response = await adminAgent
        .patch(`/api/recipients/${testRecipient.id}`)
        .send({ contactEmail: 'invalid-email' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent recipient', async () => {
      const response = await adminAgent
        .patch('/api/recipients/999999')
        .send({ contactName: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should prevent updating to duplicate organization name', async () => {
      // Create another recipient
      await adminAgent.post('/api/recipients').send({
        organizationName: 'Another Org',
        contactName: 'Another Contact',
        contactEmail: 'another@org.com',
      });

      // Try to update first recipient to same name
      const response = await adminAgent
        .patch(`/api/recipients/${testRecipient.id}`)
        .send({ organizationName: 'Another Org' });

      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/recipients/:id', () => {
    let testRecipient: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/recipients')
        .send({
          organizationName: 'To Delete Org',
          contactName: 'Delete Me',
          contactEmail: 'delete@org.com',
        });
      testRecipient = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app).delete(`/api/recipients/${testRecipient.id}`);
      expect(response.status).toBe(401);
    });

    it('should require RECIPIENTS_DELETE permission', async () => {
      const response = await request(app)
        .delete(`/api/recipients/${testRecipient.id}`)
        .set('Cookie', ['session=no-delete-permission']);

      expect(response.status).toBe(403);
    });

    it('should delete recipient with proper permissions', async () => {
      const response = await adminAgent.delete(`/api/recipients/${testRecipient.id}`);
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent recipient', async () => {
      const response = await adminAgent.delete('/api/recipients/999999');
      expect(response.status).toBe(404);
    });

    it('should actually remove recipient from database', async () => {
      await adminAgent.delete(`/api/recipients/${testRecipient.id}`);

      const response = await adminAgent.get('/api/recipients');
      const deletedRecipient = response.body.find(
        (r: any) => r.id === testRecipient.id
      );
      expect(deletedRecipient).toBeUndefined();
    });

    it('should prevent deletion if recipient has active collections', async () => {
      // Create a collection associated with this recipient
      await adminAgent.post('/api/collections').send({
        recipientId: testRecipient.id,
        collectionDate: '2025-10-25',
        sandwichesCollected: 100,
      });

      const response = await adminAgent.delete(`/api/recipients/${testRecipient.id}`);

      expect(response.status).toBe(409); // Conflict
      expect(response.body.message).toContain('collections');
    });
  });

  describe('GET /api/recipients/:id/collections', () => {
    let testRecipient: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/recipients')
        .send({
          organizationName: 'Recipient With Collections',
          contactName: 'Contact',
          contactEmail: 'contact@recipient.org',
        });
      testRecipient = response.body;
    });

    it('should return collections for a recipient', async () => {
      // Create some collections for this recipient
      await adminAgent.post('/api/collections').send({
        recipientId: testRecipient.id,
        collectionDate: '2025-10-25',
        sandwichesCollected: 100,
      });

      const response = await authenticatedAgent.get(
        `/api/recipients/${testRecipient.id}/collections`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((collection: any) => {
        expect(collection.recipientId).toBe(testRecipient.id);
      });
    });

    it('should support date range filtering', async () => {
      const response = await authenticatedAgent
        .get(`/api/recipients/${testRecipient.id}/collections`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/recipients/stats', () => {
    it('should return recipient statistics', async () => {
      const response = await adminAgent.get('/api/recipients/stats');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRecipients');
      expect(response.body).toHaveProperty('activeRecipients');
      expect(typeof response.body.totalRecipients).toBe('number');
    });
  });
});
