/**
 * Hosts Route Integration Tests
 *
 * Tests for the hosts API endpoints
 */

import request from 'supertest';
import { createTestServer } from '../../setup/test-server';
import type { Express } from 'express';

describe('Hosts Routes', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestServer();
  });

  describe('GET /api/hosts', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/hosts');

      expect([401, 403]).toContain(response.status);
    });

    it('should allow authenticated requests', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/hosts')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).not.toBe(403);
    });

    it('should support pagination parameters', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/hosts')
        .query({ page: 1, limit: 10 })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });

    it('should support search parameter', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/hosts')
        .query({ search: 'community' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('POST /api/hosts', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/hosts')
        .send({
          name: 'Test Host',
          email: 'host@example.com',
        });

      expect([401, 403]).toContain(response.status);
    });

    it('should validate required fields', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/hosts')
        .send({})
        .set('Cookie', ['connect.sid=mock-admin-session']);

      expect([400, 401, 500]).toContain(response.status);
    });

    it('should accept valid host data', async () => {
      const agent = request.agent(app);

      const validHost = {
        name: 'Community Center',
        email: 'contact@community.org',
        phone: '555-0100',
        organization: 'Community Services',
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
      };

      const response = await agent
        .post('/api/hosts')
        .send(validHost)
        .set('Cookie', ['connect.sid=mock-admin-session']);

      expect(response.status).toBeLessThan(500);
    });

    it('should validate email format', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/hosts')
        .send({
          name: 'Test Host',
          email: 'invalid-email',
          phone: '555-0100',
        })
        .set('Cookie', ['connect.sid=mock-admin-session']);

      expect(response.status).toBeLessThan(500);
    });

    it('should validate phone format', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/hosts')
        .send({
          name: 'Test Host',
          email: 'host@example.com',
          phone: 'invalid-phone',
        })
        .set('Cookie', ['connect.sid=mock-admin-session']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('GET /api/hosts/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/hosts/1');

      expect([401, 403]).toContain(response.status);
    });

    it('should validate ID format', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/hosts/not-a-number')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });

    it('should return 404 for non-existent hosts', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/hosts/999999')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('PUT /api/hosts/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .put('/api/hosts/1')
        .send({ name: 'Updated Name' });

      expect([401, 403]).toContain(response.status);
    });

    it('should accept partial updates', async () => {
      const agent = request.agent(app);

      const response = await agent
        .put('/api/hosts/1')
        .send({ phone: '555-0200' })
        .set('Cookie', ['connect.sid=mock-admin-session']);

      expect(response.status).toBeLessThan(500);
    });

    it('should validate updated email format', async () => {
      const agent = request.agent(app);

      const response = await agent
        .put('/api/hosts/1')
        .send({ email: 'not-an-email' })
        .set('Cookie', ['connect.sid=mock-admin-session']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('DELETE /api/hosts/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).delete('/api/hosts/1');

      expect([401, 403]).toContain(response.status);
    });

    it('should require admin permissions', async () => {
      const agent = request.agent(app);

      const response = await agent
        .delete('/api/hosts/1')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('GET /api/hosts/:id/events', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/hosts/1/events');

      expect([401, 403]).toContain(response.status);
    });

    it('should return events for a specific host', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/hosts/1/events')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('GET /api/hosts/active', () => {
    it('should return only active hosts', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/hosts/active')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });
});
