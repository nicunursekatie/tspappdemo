/**
 * Integration tests for groups-catalog routes
 * Tests the groups catalog endpoint with focus on partner organization handling
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
import { storage } from '../../../server/storage-wrapper';

// This will be populated by setup
let app: express.Application;
let testUser: Record<string, unknown>;
let authenticatedAgent: request.SuperAgentTest;

describe('Groups Catalog Routes', () => {
  beforeAll(async () => {
    // Create test server
    app = await createTestServer();

    // Create test user with appropriate permissions
    testUser = await createTestUser({
      role: 'volunteer',
      permissions: [
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.EVENT_REQUESTS_VIEW,
      ],
    });

    authenticatedAgent = await createAuthenticatedAgent(app, testUser);
  });

  describe('GET /api/groups-catalog', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/groups-catalog');
      expect([401, 403]).toContain(response.status);
    });

    it('should return groups catalog for authenticated users', async () => {
      const response = await authenticatedAgent.get('/api/groups-catalog');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('groups');
      expect(Array.isArray(response.body.groups)).toBe(true);
    });

    it('should accept viewMode parameter', async () => {
      const response = await authenticatedAgent
        .get('/api/groups-catalog')
        .query({ viewMode: 'aggregated' });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('groups');
    });

    it('should reject invalid viewMode parameter', async () => {
      const response = await authenticatedAgent
        .get('/api/groups-catalog')
        .query({ viewMode: 'invalid' });
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    describe('Partner organization handling', () => {
      let createdEventRequestId: number;

      beforeEach(async () => {
        // Clean up any existing test event requests
        if (createdEventRequestId) {
          try {
            await storage.deleteEventRequest(createdEventRequestId);
          } catch (e) {
            // Ignore errors if already deleted
          }
        }
      });

      afterAll(async () => {
        // Clean up test data
        if (createdEventRequestId) {
          try {
            await storage.deleteEventRequest(createdEventRequestId);
          } catch (e) {
            // Ignore errors if already deleted
          }
        }
      });

      it('should skip partner entries when they match the primary organization name', async () => {
        // Create an event request with a partner that matches the primary org
        const eventRequest = {
          organizationName: 'First Baptist Church',
          department: 'Youth Ministry',
          contactName: 'John Doe',
          contactEmail: 'john@example.com',
          contactPhone: '555-1234',
          desiredEventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedAttendees: 50,
          status: 'pending',
          partnerOrganizations: [
            { name: 'First Baptist Church', role: 'partner' }, // Same as primary
            { name: 'Second Methodist Church', role: 'partner' }, // Different org
          ],
        };

        // Create the event request
        createdEventRequestId = await storage.createEventRequest(eventRequest);

        // Fetch the groups catalog
        const response = await authenticatedAgent.get('/api/groups-catalog');
        expect(response.status).toBe(200);

        const groups = response.body.groups;

        // Count how many times "First Baptist Church" appears
        const firstBaptistEntries = groups.filter(
          (g: any) => 
            g.organizationName === 'First Baptist Church' ||
            (g.canonicalName && g.canonicalName.includes('firstbaptist'))
        );

        // Should only appear once (as primary org), not duplicated as partner
        // The exact count depends on whether there are multiple departments, but we should
        // not have duplicate entries for the same org
        const uniqueCanonicalNames = new Set(
          firstBaptistEntries.map((g: any) => `${g.canonicalName}||${g.department || ''}`)
        );

        // All entries should be unique (no duplicates due to partner matching primary)
        expect(uniqueCanonicalNames.size).toBe(firstBaptistEntries.length);
      });

      it('should create partner entries when they do not match the primary organization', async () => {
        // Create an event request with a partner that does NOT match the primary org
        const eventRequest = {
          organizationName: 'First Baptist Church',
          department: 'Youth Ministry',
          contactName: 'John Doe',
          contactEmail: 'john@example.com',
          contactPhone: '555-1234',
          desiredEventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedAttendees: 50,
          status: 'pending',
          partnerOrganizations: [
            { name: 'Second Methodist Church', role: 'partner' },
          ],
        };

        // Create the event request
        createdEventRequestId = await storage.createEventRequest(eventRequest);

        // Fetch the groups catalog
        const response = await authenticatedAgent.get('/api/groups-catalog');
        expect(response.status).toBe(200);

        const groups = response.body.groups;

        // Check if Second Methodist Church appears as a partner entry
        const partnerEntries = groups.filter(
          (g: any) =>
            g.organizationName === 'Second Methodist Church' ||
            (g.canonicalName && g.canonicalName.includes('methodist'))
        );

        // Should have at least one entry for the partner organization
        // (it might have more if there are historical events, but should have at least one)
        expect(partnerEntries.length).toBeGreaterThanOrEqual(1);
      });

      it('should handle name variations when matching partner to primary org', async () => {
        // Test that organizationNamesMatch handles variations correctly
        const eventRequest = {
          organizationName: 'First Baptist Church',
          department: 'Youth Ministry',
          contactName: 'John Doe',
          contactEmail: 'john@example.com',
          contactPhone: '555-1234',
          desiredEventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedAttendees: 50,
          status: 'pending',
          partnerOrganizations: [
            { name: 'The First Baptist Church', role: 'partner' }, // "The" prefix
            { name: 'First Baptist', role: 'partner' }, // Shorter version
          ],
        };

        // Create the event request
        createdEventRequestId = await storage.createEventRequest(eventRequest);

        // Fetch the groups catalog
        const response = await authenticatedAgent.get('/api/groups-catalog');
        expect(response.status).toBe(200);

        const groups = response.body.groups;

        // Count entries for First Baptist Church (should deduplicate variations)
        const firstBaptistEntries = groups.filter(
          (g: any) =>
            g.organizationName?.toLowerCase().includes('first baptist') ||
            (g.canonicalName && g.canonicalName.includes('firstbaptist'))
        );

        // Should have minimal duplication - variations of the same org should be matched
        const uniqueCanonicalNames = new Set(
          firstBaptistEntries.map((g: any) => g.canonicalName)
        );

        // All entries with similar names should map to the same canonical name
        // (allowing for historical entries from collections that might exist)
        expect(uniqueCanonicalNames.size).toBeLessThanOrEqual(2);
      });
    });
  });
});
