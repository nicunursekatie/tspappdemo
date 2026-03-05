# Server Type Definitions

This directory contains TypeScript type definitions for the server, providing type safety for Express routes, middleware, and dependencies.

## Core Types

### Request Types

- **`AuthenticatedRequest`** - Use for routes that require authentication. Includes typed `user` and `session`.
- **`MaybeAuthenticatedRequest`** - Use for routes where authentication is optional.
- **`StandardHandler`** - Standard Express request handler (no auth).

### User Types

- **`SessionUser`** - Structure for user data stored in session
- **`ReplitUser`** - Structure for Replit authentication
- **`AppSession`** - Extended session interface with user data

### Middleware Types

- **`AuthMiddleware`** - Type for `isAuthenticated` middleware
- **`PermissionMiddleware`** - Type for `requirePermission` middleware factory

### Dependency Types

- **`RouterDependencies`** - Standard dependencies for route modules
- **`AuthDependencies`** - Minimal auth-only dependencies
- **`AdminDependencies`** - Admin route dependencies
- **`ProjectDependencies`** - Project route dependencies

## Usage Examples

### Typed Route Handlers

#### Basic Authenticated Route

```typescript
import { Router, Response } from 'express';
import { AuthenticatedRequest, getUserId } from '../types';

const router = Router();

router.get('/data', async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // TypeScript knows userId is string here
  const data = await fetchUserData(userId);
  res.json(data);
});
```

#### Route with Schema Validation

```typescript
import { insertMeetingSchema } from '@shared/schema';
import { AuthenticatedRequest, getUserId } from '../types';

router.post('/meetings', async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Schema validation with proper typing
  const meetingData = insertMeetingSchema.parse(req.body);

  const meeting = await storage.createMeeting(meetingData);
  res.status(201).json(meeting);
});
```

#### Optional Authentication

```typescript
import { MaybeAuthenticatedRequest } from '../types';

router.get('/public-data', async (req: MaybeAuthenticatedRequest, res: Response) => {
  const userId = getUserId(req); // May be undefined

  if (userId) {
    // Return personalized data
    const data = await getPersonalizedData(userId);
    return res.json(data);
  }

  // Return public data
  const data = await getPublicData();
  res.json(data);
});
```

### Typed Router Dependencies

#### Creating a Router with Dependencies

```typescript
import { Router, Response } from 'express';
import {
  AuthDependencies,
  AuthenticatedRequest,
  SessionUser
} from '../types';

export function createAuthRoutes(deps: AuthDependencies) {
  const router = Router();

  router.post('/login', async (req: Request, res: Response) => {
    // deps.isAuthenticated is properly typed
    // No more `any` types!
  });

  return router;
}
```

#### Router with Storage Dependency

```typescript
import { IStorage } from '../storage';
import { AuthMiddleware, AuthenticatedRequest } from '../types';

export default function createDataRouter(
  isAuthenticated: AuthMiddleware,
  storage: IStorage
) {
  const router = Router();

  router.get('/', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    // storage is properly typed as IStorage
    const items = await storage.getAllItems();
    res.json(items);
  });

  return router;
}
```

### Helper Functions

#### `getUserId(req)`

Extracts user ID from either session auth or Replit auth:

```typescript
import { getUserId } from '../types';

const userId = getUserId(req);
if (!userId) {
  return res.status(401).json({ message: 'Not authenticated' });
}
// userId is string here
```

#### `getSessionUser(req)`

Gets the full user object from session or request:

```typescript
import { getSessionUser } from '../types';

const user = getSessionUser(req);
if (!user) {
  return res.status(401).json({ message: 'Not authenticated' });
}
// user is SessionUser here
console.log(user.email, user.role);
```

## Migration Guide

### Before (with `any`)

```typescript
router.get('/data', async (req: any, res) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  // TypeScript can't help us here
});

function createRouter(isAuthenticated: any, storage: any) {
  // No type safety
}
```

### After (typed)

```typescript
import { AuthenticatedRequest, getUserId } from '../types';
import { AuthMiddleware } from '../types';
import { IStorage } from '../storage';

router.get('/data', async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req);
  // TypeScript provides autocomplete and type checking
});

function createRouter(
  isAuthenticated: AuthMiddleware,
  storage: IStorage
) {
  // Full type safety
}
```

## Benefits

1. **Type Safety** - Catch errors at compile time instead of runtime
2. **Autocomplete** - IDEs can suggest properties and methods
3. **Refactoring** - Confidently rename and restructure code
4. **Documentation** - Types serve as inline documentation
5. **Schema Integration** - Proper typing with Zod schemas

## Best Practices

1. **Always type request handlers** - Use `AuthenticatedRequest`, `MaybeAuthenticatedRequest`, or `Request`
2. **Use helper functions** - `getUserId()` and `getSessionUser()` handle both auth methods
3. **Type dependencies** - Replace `any` with specific interfaces
4. **Validate with schemas** - Combine Zod schemas with TypeScript types
5. **Export from index** - Import all types from `../types` for consistency
