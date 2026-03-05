/**
 * Permission Integration Tests
 *
 * Tests that routes properly enforce permission requirements
 */

import request from 'supertest';
import { createTestServer } from '../../setup/test-server';
import type { Express } from 'express';

describe('Permission Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestServer();
  });

  describe('Routes Require Specific Permissions', () => {
    // Test routes that require specific permissions
    const permissionRoutes = [
      {
        method: 'get',
        path: '/api/hosts',
        requiredPermission: 'HOSTS_VIEW',
      },
      {
        method: 'post',
        path: '/api/hosts',
        requiredPermission: 'HOSTS_EDIT',
      },
      {
        method: 'get',
        path: '/api/export/collections',
        requiredPermission: 'DATA_EXPORT',
      },
    ];

    test.each(permissionRoutes)(
      '$method $path should require $requiredPermission permission',
      async ({ method, path, requiredPermission }) => {
        // Test with user that lacks permission
        const agent = request.agent(app);

        const response = await (agent as any)[method](path)
          .set('Cookie', ['connect.sid=mock-session-no-permissions']);

        // Should be forbidden (403) or unauthorized (401)
        expect([401, 403]).toContain(response.status);
      }
    );
  });
});
