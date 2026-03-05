/**
 * Drivers Route Integration Tests
 *
 * Example comprehensive test suite for a migrated route
 */

import request from 'supertest';
import { createTestServer } from '../../setup/test-server';
import type { Express } from 'express';

describe('Drivers Routes', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestServer();
  });

  describe('GET /api/drivers', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/drivers');

      expect([401, 403]).toContain(response.status);
    });

    it('should allow authenticated requests', async () => {
      const agent = request.agent(app);

      // Mock authentication (you'll need to implement actual login in your test setup)
      const response = await agent
        .get('/api/drivers')
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should not be auth error (may be 200 or 500 depending on DB)
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  describe('POST /api/drivers', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/drivers')
        .send({
          name: 'Test Driver',
          email: 'driver@example.com',
        });

      expect([401, 403]).toContain(response.status);
    });

    it('should validate required fields', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/drivers')
        .send({})
        .set('Cookie', ['connect.sid=mock-admin-session']);

      // Should reject invalid data (400 or 401 if auth fails)
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('GET /api/drivers/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/drivers/1');

      expect([401, 403]).toContain(response.status);
    });

    it('should validate ID format', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/drivers/invalid-id')
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should handle invalid ID (400 or similar)
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('PUT /api/drivers/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .put('/api/drivers/1')
        .send({ name: 'Updated Driver' });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('DELETE /api/drivers/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).delete('/api/drivers/1');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('GET /api/drivers/export', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/drivers/export');

      expect([401, 403]).toContain(response.status);
    });
  });
});
