/**
 * Quick verification that test setup works correctly
 */

import { createTestServer, createTestUser, createAuthenticatedAgent } from './setup/test-server';
import { storage } from '../server/storage-wrapper';

async function verifySetup() {
  console.log('🧪 Verifying test setup...\n');

  try {
    // Step 1: Create test server
    console.log('1. Creating test server...');
    const app = await createTestServer();
    console.log('   ✅ Test server created\n');

    // Step 2: Create test user
    console.log('2. Creating test user...');
    const testUser = await createTestUser({
      email: 'verify@example.com',
      password: 'testpass123',
      role: 'volunteer',
    });
    console.log(`   ✅ Test user created: ${testUser.email} (${testUser.role})`);
    console.log(`   User ID: ${testUser.id}`);
    console.log(`   Has password field: ${!!testUser.password}`);
    console.log(`   Password length: ${testUser.password?.length}`);

    // Verify we can retrieve the user from storage
    const retrievedUser = await storage.getUserByEmail(testUser.email);
    console.log(`   Can retrieve user from storage: ${!!retrievedUser}`);
    if (retrievedUser) {
      console.log(`   Retrieved user has password: ${!!retrievedUser.password}`);
      console.log(`   Retrieved user is active: ${retrievedUser.isActive}`);
    }
    console.log('');

    // Step 3: Create authenticated agent
    console.log('3. Creating authenticated agent...');
    console.log(`   Attempting login with: ${testUser.email}`);
    const agent = await createAuthenticatedAgent(app, {
      email: testUser.email,
      password: testUser.password,
    });
    console.log('   ✅ Authenticated agent created\n');

    // Step 4: Test authenticated request
    console.log('4. Testing authenticated request...');
    const response = await agent.get('/api/auth/user');
    console.log(`   Response status: ${response.status}`);
    console.log(`   Response body:`, response.body);

    if (response.status === 200) {
      console.log('   ✅ Authentication successful!\n');
    } else {
      console.log('   ❌ Authentication failed!\n');
      return false;
    }

    console.log('🎉 All setup verification passed!');
    return true;
  } catch (error) {
    console.error('❌ Setup verification failed:', error);
    return false;
  }
}

// Run verification
verifySetup()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
