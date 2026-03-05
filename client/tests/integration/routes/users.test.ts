/**
 * Integration tests for users routes
 * Tests user management with strict permission checking
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { PERMISSIONS, USER_ROLES } from '../../../shared/auth-utils';
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

describe('Users Routes', () => {
  beforeAll(async () => {
    // Create test server
    app = await createTestServer();

    // Create test users
    testUser = await createTestUser({
      role: 'volunteer',
      permissions: [PERMISSIONS.USERS_VIEW],
    });

    adminUser = await createTestUser({
      role: 'admin',
      email: 'admin_users@example.com',
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

  describe('GET /api/users/for-assignments', () => {
    it('should return list of assignable users without special permission', async () => {
      const response = await authenticatedAgent.get('/api/users/for-assignments');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should include basic user information', async () => {
      const response = await authenticatedAgent.get('/api/users/for-assignments');
      expect(response.status).toBe(200);

      if (response.body.length > 0) {
        const user = response.body[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('firstName');
        expect(user).toHaveProperty('lastName');
      }
    });
  });

  describe('GET /api/users/basic', () => {
    it('should return basic user information without special permission', async () => {
      const response = await authenticatedAgent.get('/api/users/basic');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/users', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/users');
      expect(response.status).toBe(401);
    });

    it('should require USERS_EDIT permission', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', ['session=no-users-edit-permission']);

      expect(response.status).toBe(403);
    });

    it('should return all users with proper permission', async () => {
      const response = await adminAgent.get('/api/users');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should include full user details with proper permission', async () => {
      const response = await adminAgent.get('/api/users');
      expect(response.status).toBe(200);

      if (response.body.length > 0) {
        const user = response.body[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('permissions');
        expect(user).toHaveProperty('isActive');
      }
    });
  });

  describe('POST /api/users', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
          role: USER_ROLES.VOLUNTEER,
        });

      expect(response.status).toBe(401);
    });

    it('should require USERS_EDIT permission', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Cookie', ['session=no-users-edit-permission'])
        .send({
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
          role: USER_ROLES.VOLUNTEER,
        });

      expect(response.status).toBe(403);
    });

    it('should create user with valid data', async () => {
      const newUser = {
        email: `newuser_${Date.now()}@example.com`,
        firstName: 'New',
        lastName: 'User',
        role: USER_ROLES.VOLUNTEER,
      };

      const response = await adminAgent
        .post('/api/users')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        email: newUser.email,
        firstName: 'New',
        lastName: 'User',
        role: USER_ROLES.VOLUNTEER,
      });
      expect(response.body.id).toBeDefined();
    });

    it('should prevent creating duplicate users', async () => {
      const newUser = {
        email: `duplicate_${Date.now()}@example.com`,
        firstName: 'Duplicate',
        lastName: 'User',
        role: USER_ROLES.VOLUNTEER,
      };

      // Create first user
      await adminAgent.post('/api/users').send(newUser);

      // Try to create duplicate
      const response = await adminAgent.post('/api/users').send(newUser);

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await adminAgent
        .post('/api/users')
        .send({
          firstName: 'Missing',
          lastName: 'Email',
          // Missing email and role
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    it('should validate email format', async () => {
      const response = await adminAgent
        .post('/api/users')
        .send({
          email: 'invalid-email-format',
          firstName: 'Test',
          lastName: 'User',
          role: USER_ROLES.VOLUNTEER,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/users/:id', () => {
    let testUserForUpdate: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/users')
        .send({
          email: `updatetest_${Date.now()}@example.com`,
          firstName: 'Update',
          lastName: 'Test',
          role: USER_ROLES.VOLUNTEER,
        });
      testUserForUpdate = response.body;
    });

    it('should require USERS_EDIT permission', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserForUpdate.id}`)
        .set('Cookie', ['session=no-users-edit-permission'])
        .send({ role: USER_ROLES.HOST });

      expect(response.status).toBe(403);
    });

    it('should update user role', async () => {
      const response = await adminAgent
        .patch(`/api/users/${testUserForUpdate.id}`)
        .send({ role: USER_ROLES.HOST });

      expect(response.status).toBe(200);
      expect(response.body.role).toBe(USER_ROLES.HOST);
    });

    it('should update user permissions', async () => {
      const newPermissions = [PERMISSIONS.HOSTS_VIEW, PERMISSIONS.DRIVERS_VIEW];

      const response = await adminAgent
        .patch(`/api/users/${testUserForUpdate.id}`)
        .send({ permissions: newPermissions });

      expect(response.status).toBe(200);
      expect(response.body.permissions).toContain(PERMISSIONS.HOSTS_VIEW);
      expect(response.body.permissions).toContain(PERMISSIONS.DRIVERS_VIEW);
    });

    it('should apply permission dependencies when updating permissions', async () => {
      // NAV_HOSTS should automatically grant HOSTS_VIEW
      const response = await adminAgent
        .patch(`/api/users/${testUserForUpdate.id}`)
        .send({ permissions: [PERMISSIONS.NAV_HOSTS] });

      expect(response.status).toBe(200);
      expect(response.body.permissions).toContain(PERMISSIONS.NAV_HOSTS);
      expect(response.body.permissions).toContain(PERMISSIONS.HOSTS_VIEW);
    });

    it('should update user metadata', async () => {
      const metadata = {
        department: 'Logistics',
        location: 'Chicago',
      };

      const response = await adminAgent
        .patch(`/api/users/${testUserForUpdate.id}`)
        .send({ metadata });

      expect(response.status).toBe(200);
      expect(response.body.metadata).toMatchObject(metadata);
    });
  });

  describe('PATCH /api/users/:id/status', () => {
    let testUserForStatus: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/users')
        .send({
          email: `statustest_${Date.now()}@example.com`,
          firstName: 'Status',
          lastName: 'Test',
          role: USER_ROLES.VOLUNTEER,
        });
      testUserForStatus = response.body;
    });

    it('should require USERS_EDIT permission', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserForStatus.id}/status`)
        .set('Cookie', ['session=no-users-edit-permission'])
        .send({ isActive: false });

      expect(response.status).toBe(403);
    });

    it('should deactivate user', async () => {
      const response = await adminAgent
        .patch(`/api/users/${testUserForStatus.id}/status`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);
    });

    it('should reactivate user', async () => {
      // First deactivate
      await adminAgent
        .patch(`/api/users/${testUserForStatus.id}/status`)
        .send({ isActive: false });

      // Then reactivate
      const response = await adminAgent
        .patch(`/api/users/${testUserForStatus.id}/status`)
        .send({ isActive: true });

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(true);
    });
  });

  describe('PATCH /api/users/:id/profile', () => {
    let testUserForProfile: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/users')
        .send({
          email: `profiletest_${Date.now()}@example.com`,
          firstName: 'Profile',
          lastName: 'Test',
          role: USER_ROLES.VOLUNTEER,
        });
      testUserForProfile = response.body;
    });

    it('should require USERS_EDIT permission', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserForProfile.id}/profile`)
        .set('Cookie', ['session=no-users-edit-permission'])
        .send({ firstName: 'Updated' });

      expect(response.status).toBe(403);
    });

    it('should update user profile information', async () => {
      const updates = {
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast',
        phoneNumber: '555-0199',
        preferredEmail: 'preferred@example.com',
      };

      const response = await adminAgent
        .patch(`/api/users/${testUserForProfile.id}/profile`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe('UpdatedFirst');
      expect(response.body.lastName).toBe('UpdatedLast');
      expect(response.body.phoneNumber).toBe('555-0199');
      expect(response.body.preferredEmail).toBe('preferred@example.com');
    });

    it('should allow updating email address', async () => {
      const newEmail = `newemail_${Date.now()}@example.com`;

      const response = await adminAgent
        .patch(`/api/users/${testUserForProfile.id}/profile`)
        .send({ email: newEmail });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(newEmail);
    });

    it('should allow updating role and status in profile', async () => {
      const response = await adminAgent
        .patch(`/api/users/${testUserForProfile.id}/profile`)
        .send({
          role: USER_ROLES.HOST,
          isActive: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.role).toBe(USER_ROLES.HOST);
      expect(response.body.isActive).toBe(false);
    });
  });

  describe('PATCH /api/users/:id/password', () => {
    let testUserForPassword: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/users')
        .send({
          email: `passwordtest_${Date.now()}@example.com`,
          firstName: 'Password',
          lastName: 'Test',
          role: USER_ROLES.VOLUNTEER,
        });
      testUserForPassword = response.body;
    });

    it('should require USERS_EDIT permission', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserForPassword.id}/password`)
        .set('Cookie', ['session=no-users-edit-permission'])
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(403);
    });

    it('should update user password', async () => {
      const response = await adminAgent
        .patch(`/api/users/${testUserForPassword.id}/password`)
        .send({ password: 'SecurePassword123!' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('updated successfully');
    });

    it('should validate password strength', async () => {
      const response = await adminAgent
        .patch(`/api/users/${testUserForPassword.id}/password`)
        .send({ password: '123' }); // Too short

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('must be at least');
    });

    it('should require password field', async () => {
      const response = await adminAgent
        .patch(`/api/users/${testUserForPassword.id}/password`)
        .send({}); // Missing password

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/users/:id', () => {
    let testUserForDelete: any;

    beforeEach(async () => {
      const response = await adminAgent
        .post('/api/users')
        .send({
          email: `deletetest_${Date.now()}@example.com`,
          firstName: 'Delete',
          lastName: 'Test',
          role: USER_ROLES.VOLUNTEER,
        });
      testUserForDelete = response.body;
    });

    it('should require authentication', async () => {
      const response = await request(app).delete(`/api/users/${testUserForDelete.id}`);
      expect(response.status).toBe(401);
    });

    it('should require USERS_EDIT permission', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUserForDelete.id}`)
        .set('Cookie', ['session=no-users-edit-permission']);

      expect(response.status).toBe(403);
    });

    it('should delete user with proper permission', async () => {
      const response = await adminAgent.delete(`/api/users/${testUserForDelete.id}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await adminAgent.delete('/api/users/99999999');
      expect(response.status).toBe(404);
    });

    it('should actually remove user from database', async () => {
      await adminAgent.delete(`/api/users/${testUserForDelete.id}`);

      const allUsers = await adminAgent.get('/api/users');
      const deletedUser = allUsers.body.find((u: any) => u.id === testUserForDelete.id);
      expect(deletedUser).toBeUndefined();
    });

    it('should not allow deleting super_admin users', async () => {
      // Assuming adminUser is a super_admin
      const response = await adminAgent.delete(`/api/users/${adminUser.id}`);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Security - Permission Boundaries', () => {
    it('should not allow users without USERS_EDIT to view full user list', async () => {
      const response = await authenticatedAgent.get('/api/users');
      expect(response.status).toBe(403);
    });

    it('should not allow users without USERS_EDIT to create users', async () => {
      const response = await authenticatedAgent
        .post('/api/users')
        .send({
          email: 'unauthorized@example.com',
          firstName: 'Unauthorized',
          lastName: 'User',
          role: USER_ROLES.VOLUNTEER,
        });

      expect(response.status).toBe(403);
    });

    it('should not allow users without USERS_EDIT to modify others', async () => {
      const response = await authenticatedAgent
        .patch(`/api/users/${adminUser.id}`)
        .send({ role: USER_ROLES.VOLUNTEER });

      expect(response.status).toBe(403);
    });

    it('should not allow users without USERS_EDIT to delete others', async () => {
      const response = await authenticatedAgent.delete(`/api/users/${adminUser.id}`);
      expect(response.status).toBe(403);
    });
  });
});
