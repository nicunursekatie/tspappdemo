/**
 * Integration tests for notifications routes
 * Tests notification creation, retrieval, and management
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

describe('Notifications Routes', () => {
  beforeAll(async () => {
    // Create test server
    app = await createTestServer();

    // Create test users
    testUser = await createTestUser({
      role: 'volunteer',
    });

    adminUser = await createTestUser({
      role: 'admin',
      email: 'admin_notifications@example.com',
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

  describe('GET /api/notifications', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/notifications');
      expect(response.status).toBe(401);
    });

    it('should return notifications for authenticated user', async () => {
      const response = await authenticatedAgent.get('/api/notifications');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should only return notifications for the current user', async () => {
      const response = await authenticatedAgent.get('/api/notifications');
      expect(response.status).toBe(200);

      response.body.forEach((notification: any) => {
        expect(notification.userId).toBe(testUser.id);
      });
    });

    it('should support filtering by read status', async () => {
      const response = await authenticatedAgent
        .get('/api/notifications')
        .query({ unreadOnly: true });

      expect(response.status).toBe(200);
      response.body.forEach((notification: any) => {
        expect(notification.isRead).toBe(false);
      });
    });

    it('should support pagination', async () => {
      const response = await authenticatedAgent
        .get('/api/notifications')
        .query({ limit: 5, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/notifications/unread-count');
      expect(response.status).toBe(401);
    });

    it('should return unread notification count', async () => {
      const response = await authenticatedAgent.get('/api/notifications/unread-count');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });
  });

  describe('POST /api/notifications', () => {
    it('should create a notification', async () => {
      const notification = {
        userId: testUser.id,
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info',
      };

      const response = await authenticatedAgent
        .post('/api/notifications')
        .send(notification);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info',
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.isRead).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await authenticatedAgent
        .post('/api/notifications')
        .send({
          // Missing required fields
          type: 'info',
        });

      expect(response.status).toBe(400);
    });

    it('should validate notification type', async () => {
      const response = await authenticatedAgent
        .post('/api/notifications')
        .send({
          userId: testUser.id,
          title: 'Test',
          message: 'Test message',
          type: 'invalid-type',
        });

      expect(response.status).toBe(400);
    });

    it('should set default values correctly', async () => {
      const response = await authenticatedAgent
        .post('/api/notifications')
        .send({
          userId: testUser.id,
          title: 'Test',
          message: 'Test message',
        });

      expect(response.status).toBe(201);
      expect(response.body.isRead).toBe(false);
      expect(response.body.createdAt).toBeDefined();
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    let testNotification: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/notifications')
        .send({
          userId: testUser.id,
          title: 'Test Notification',
          message: 'Test message',
          type: 'info',
        });
      testNotification = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch(`/api/notifications/${testNotification.id}/read`);
      expect(response.status).toBe(401);
    });

    it('should mark notification as read', async () => {
      const response = await authenticatedAgent
        .patch(`/api/notifications/${testNotification.id}/read`);

      expect(response.status).toBe(200);
      expect(response.body.isRead).toBe(true);
    });

    it('should not allow marking others notifications as read', async () => {
      // Create notification for admin
      const adminNotification = await adminAgent
        .post('/api/notifications')
        .send({
          userId: adminUser.id,
          title: 'Admin Notification',
          message: 'For admin only',
          type: 'info',
        });

      // Try to mark it as read with regular user
      const response = await authenticatedAgent
        .patch(`/api/notifications/${adminNotification.body.id}/read`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent notification', async () => {
      const response = await authenticatedAgent
        .patch('/api/notifications/999999/read');
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    beforeEach(async () => {
      // Create multiple unread notifications
      await authenticatedAgent.post('/api/notifications').send({
        userId: testUser.id,
        title: 'Notification 1',
        message: 'Message 1',
        type: 'info',
      });
      await authenticatedAgent.post('/api/notifications').send({
        userId: testUser.id,
        title: 'Notification 2',
        message: 'Message 2',
        type: 'info',
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).patch('/api/notifications/read-all');
      expect(response.status).toBe(401);
    });

    it('should mark all notifications as read for current user', async () => {
      const response = await authenticatedAgent.patch('/api/notifications/read-all');
      expect(response.status).toBe(200);

      // Verify all notifications are read
      const allNotifications = await authenticatedAgent.get('/api/notifications');
      allNotifications.body.forEach((notification: any) => {
        expect(notification.isRead).toBe(true);
      });
    });

    it('should only affect current user notifications', async () => {
      // Create admin notification
      await adminAgent.post('/api/notifications').send({
        userId: adminUser.id,
        title: 'Admin Notification',
        message: 'Admin message',
        type: 'info',
      });

      // Mark all as read for test user
      await authenticatedAgent.patch('/api/notifications/read-all');

      // Verify admin notification is still unread
      const adminNotifications = await adminAgent.get('/api/notifications');
      const unreadCount = adminNotifications.body.filter((n: any) => !n.isRead).length;
      expect(unreadCount).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    let testNotification: any;

    beforeEach(async () => {
      const response = await authenticatedAgent
        .post('/api/notifications')
        .send({
          userId: testUser.id,
          title: 'Test Notification',
          message: 'Test message',
          type: 'info',
        });
      testNotification = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${testNotification.id}`);
      expect(response.status).toBe(401);
    });

    it('should delete own notification', async () => {
      const response = await authenticatedAgent
        .delete(`/api/notifications/${testNotification.id}`);
      expect(response.status).toBe(200);
    });

    it('should not allow deleting others notifications', async () => {
      const adminNotification = await adminAgent
        .post('/api/notifications')
        .send({
          userId: adminUser.id,
          title: 'Admin Notification',
          message: 'For admin only',
          type: 'info',
        });

      const response = await authenticatedAgent
        .delete(`/api/notifications/${adminNotification.body.id}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent notification', async () => {
      const response = await authenticatedAgent.delete('/api/notifications/999999');
      expect(response.status).toBe(404);
    });

    it('should actually remove notification from database', async () => {
      await authenticatedAgent.delete(`/api/notifications/${testNotification.id}`);

      const allNotifications = await authenticatedAgent.get('/api/notifications');
      const deletedNotification = allNotifications.body.find(
        (n: any) => n.id === testNotification.id
      );
      expect(deletedNotification).toBeUndefined();
    });
  });

  describe('DELETE /api/notifications/clear-all', () => {
    beforeEach(async () => {
      // Create multiple notifications
      await authenticatedAgent.post('/api/notifications').send({
        userId: testUser.id,
        title: 'Notification 1',
        message: 'Message 1',
        type: 'info',
      });
      await authenticatedAgent.post('/api/notifications').send({
        userId: testUser.id,
        title: 'Notification 2',
        message: 'Message 2',
        type: 'info',
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).delete('/api/notifications/clear-all');
      expect(response.status).toBe(401);
    });

    it('should delete all notifications for current user', async () => {
      const response = await authenticatedAgent.delete('/api/notifications/clear-all');
      expect(response.status).toBe(200);

      const allNotifications = await authenticatedAgent.get('/api/notifications');
      expect(allNotifications.body.length).toBe(0);
    });

    it('should only affect current user notifications', async () => {
      // Create admin notifications
      await adminAgent.post('/api/notifications').send({
        userId: adminUser.id,
        title: 'Admin Notification',
        message: 'Admin message',
        type: 'info',
      });

      // Clear all for test user
      await authenticatedAgent.delete('/api/notifications/clear-all');

      // Verify admin notifications still exist
      const adminNotifications = await adminAgent.get('/api/notifications');
      expect(adminNotifications.body.length).toBeGreaterThan(0);
    });
  });
});
