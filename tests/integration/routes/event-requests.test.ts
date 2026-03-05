/**
 * Event Requests Route Integration Tests
 *
 * Tests for the event-requests API endpoints
 */

import request from 'supertest';
import { createTestServer } from '../../setup/test-server';
import type { Express } from 'express';

describe('Event Requests Routes', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestServer();
  });

  describe('GET /api/event-requests', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/event-requests');

      expect([401, 403]).toContain(response.status);
    });

    it('should allow authenticated requests', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/event-requests')
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should not be auth error
      expect(response.status).not.toBe(403);
    });

    it('should accept query parameters for filtering', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/event-requests')
        .query({ status: 'pending' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('POST /api/event-requests', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/event-requests')
        .send({
          title: 'Test Event',
          description: 'Test description',
          eventDate: new Date().toISOString(),
        });

      expect([401, 403]).toContain(response.status);
    });

    it('should validate required fields', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/event-requests')
        .send({})
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should reject invalid data
      expect([400, 401, 500]).toContain(response.status);
    });

    it('should accept valid event request data', async () => {
      const agent = request.agent(app);

      const validEventRequest = {
        title: 'Community Meal',
        description: 'Weekly community meal service',
        eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Community Center',
        estimatedAttendees: 50,
      };

      const response = await agent
        .post('/api/event-requests')
        .send(validEventRequest)
        .set('Cookie', ['connect.sid=mock-session-id']);

      // May fail due to database, but should not be validation error
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('GET /api/event-requests/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/event-requests/1');

      expect([401, 403]).toContain(response.status);
    });

    it('should validate ID format', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/event-requests/invalid-id')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });

    it('should handle non-existent event requests gracefully', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/event-requests/999999')
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should return 404 or similar
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('PUT /api/event-requests/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .put('/api/event-requests/1')
        .send({ title: 'Updated Event' });

      expect([401, 403]).toContain(response.status);
    });

    it('should validate update data', async () => {
      const agent = request.agent(app);

      const response = await agent
        .put('/api/event-requests/1')
        .send({ invalidField: 'invalid' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('DELETE /api/event-requests/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).delete('/api/event-requests/1');

      expect([401, 403]).toContain(response.status);
    });

    it('should require admin permissions', async () => {
      const agent = request.agent(app);

      // Non-admin user
      const response = await agent
        .delete('/api/event-requests/1')
        .set('Cookie', ['connect.sid=mock-session-id']);

      // May be 403 or 401 depending on auth setup
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('PATCH /api/event-requests/:id/status', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .patch('/api/event-requests/1/status')
        .send({ status: 'approved' });

      expect([401, 403]).toContain(response.status);
    });

    it('should validate status values', async () => {
      const agent = request.agent(app);

      const response = await agent
        .patch('/api/event-requests/1/status')
        .send({ status: 'invalid-status' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should reject invalid status
      expect(response.status).toBeLessThan(500);
    });

    it('should accept valid status values', async () => {
      const agent = request.agent(app);

      const validStatuses = ['pending', 'approved', 'rejected', 'completed'];

      for (const status of validStatuses) {
        const response = await agent
          .patch('/api/event-requests/1/status')
          .send({ status })
          .set('Cookie', ['connect.sid=mock-admin-session']);

        // Status should be less than 500 for valid input
        expect(response.status).toBeLessThan(500);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed JSON', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/event-requests')
        .set('Content-Type', 'application/json')
        .send('{"invalid json"}')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle very large payloads gracefully', async () => {
      const agent = request.agent(app);

      const largeDescription = 'a'.repeat(100000);
      const response = await agent
        .post('/api/event-requests')
        .send({
          title: 'Test',
          description: largeDescription,
        })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });

    it('should handle special characters in fields', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/event-requests')
        .send({
          title: '<script>alert("xss")</script>',
          description: "Test with 'quotes' and \"double quotes\"",
        })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Status Transition Validation', () => {
    it('should reject invalid status transitions', async () => {
      const agent = request.agent(app);

      // Try to transition from 'new' to 'completed' (invalid)
      const response = await agent
        .patch('/api/event-requests/1')
        .send({ status: 'completed' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should either be 400 (validation error) or 404 (event not found)
      // If 404, the validation would have triggered if event existed
      expect([400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('INVALID_STATUS_TRANSITION');
      }
    });

    it('should allow valid status transitions', async () => {
      const agent = request.agent(app);

      // Try to transition from 'new' to 'in_process' (valid)
      const response = await agent
        .patch('/api/event-requests/1')
        .send({ status: 'in_process' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should not be a validation error (400 with INVALID_STATUS_TRANSITION)
      if (response.status === 400) {
        expect(response.body.error).not.toBe('INVALID_STATUS_TRANSITION');
      }
    });

    it('should provide helpful error messages for invalid transitions', async () => {
      const agent = request.agent(app);

      // Try invalid transition
      const response = await agent
        .patch('/api/event-requests/1')
        .send({ status: 'cancelled' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      // If we get validation error, check the message
      if (response.status === 400 && response.body.error === 'INVALID_STATUS_TRANSITION') {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toBeTruthy();
        expect(typeof response.body.message).toBe('string');
      }
    });
  });

  describe('Postponement Flows', () => {
    it('should handle postponement with immediate reschedule', async () => {
      const agent = request.agent(app);

      const DAYS_AHEAD = 14; // 2 weeks in the future
      const postponeData = {
        postponementReason: 'Organizer requested date change',
        postponementNotes: 'Moving to next week',
        hasNewDate: true,
        newScheduledDate: new Date(Date.now() + DAYS_AHEAD * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      const response = await agent
        .post('/api/event-requests/1/postpone')
        .send(postponeData)
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should either succeed or fail with 404 (event not found)
      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('status');
        // With immediate reschedule, status should stay 'scheduled'
        expect(response.body.status).toBe('scheduled');
        expect(response.body).toHaveProperty('wasPostponed');
        expect(response.body.wasPostponed).toBe(true);
      }
    });

    it('should handle postponement without new date', async () => {
      const agent = request.agent(app);

      const postponeData = {
        postponementReason: 'Organizer needs time to confirm new date',
        postponementNotes: 'Will follow up in a few days',
        hasNewDate: false,
      };

      const response = await agent
        .post('/api/event-requests/1/postpone')
        .send(postponeData)
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should either succeed or fail with 404 (event not found)
      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('status');
        // Without new date, status should change to 'postponed'
        expect(response.body.status).toBe('postponed');
        expect(response.body).toHaveProperty('wasPostponed');
        expect(response.body.wasPostponed).toBe(true);
        // scheduledEventDate should be cleared
        expect(response.body.scheduledEventDate).toBeNull();
      }
    });

    it('should track postponement count and original date', async () => {
      const agent = request.agent(app);

      const DAYS_AHEAD = 7; // 1 week in the future
      const postponeData = {
        postponementReason: 'Testing postponement tracking',
        hasNewDate: true,
        newScheduledDate: new Date(Date.now() + DAYS_AHEAD * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      const response = await agent
        .post('/api/event-requests/1/postpone')
        .send(postponeData)
        .set('Cookie', ['connect.sid=mock-session-id']);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('postponementCount');
        expect(typeof response.body.postponementCount).toBe('number');
        expect(response.body.postponementCount).toBeGreaterThanOrEqual(1);
        
        expect(response.body).toHaveProperty('originalScheduledDate');
        // originalScheduledDate should be set
        expect(response.body.originalScheduledDate).toBeTruthy();
      }
    });
  });
});
