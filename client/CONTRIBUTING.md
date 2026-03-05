# Contributing Guide

**The Sandwich Project Platform**
**Last Updated:** 2025-10-25

Welcome! This guide will help you contribute to the Sandwich Project Platform effectively. Whether you're fixing a bug, adding a feature, or improving documentation, we appreciate your help!

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Testing Requirements](#testing-requirements)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Documentation](#documentation)
8. [Code Review](#code-review)

---

## Getting Started

### Prerequisites

- **Node.js:** 20.x or higher
- **npm:** 10.x or higher
- **Git:** 2.x or higher
- **Code editor:** VS Code recommended (with ESLint and Prettier extensions)

### Initial Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd Sandwich-Project-Platform-Final

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your local configuration

# 4. Set up database
npm run db:push      # Apply schema
npm run db:seed      # Load sample data

# 5. Start development server
npm run dev

# 6. Verify setup
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# Monitoring: http://localhost:5000/monitoring/dashboard
```

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag"
  ]
}
```

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Development Workflow

### Branch Strategy

We use a simple branch-based workflow:

```
main (default branch)
  ↓
  └─ feature/your-feature-name
  └─ fix/bug-description
  └─ docs/documentation-update
```

### Creating a Feature Branch

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/add-user-profiles

# Branch naming conventions:
# - feature/description - New features
# - fix/description - Bug fixes
# - docs/description - Documentation
# - refactor/description - Code refactoring
# - test/description - Adding tests
# - chore/description - Maintenance tasks
```

### Making Changes

1. **Make your changes**
   - Write code
   - Add tests
   - Update documentation

2. **Test locally**
   ```bash
   npm run typecheck   # TypeScript checks
   npm run lint        # ESLint
   npm run test        # Unit + integration tests
   npm run test:e2e    # E2E tests (if applicable)
   ```

3. **Commit your changes** (see [Commit Guidelines](#commit-guidelines))
   ```bash
   git add .
   git commit -m "feat: add user profile page"
   ```

4. **Push to remote**
   ```bash
   git push origin feature/add-user-profiles
   ```

5. **Create pull request** (see [Pull Request Process](#pull-request-process))

---

## Code Standards

### TypeScript

**Use TypeScript for all new code:**

```typescript
// ✅ GOOD: Explicit types
interface User {
  id: number;
  email: string;
  role: UserRole;
}

function getUser(id: number): Promise<User> {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}

// ❌ BAD: Using 'any'
function getUser(id: any): any {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}
```

**Avoid `any` type:**

```typescript
// ❌ BAD
const data: any = await fetch('/api/users');

// ✅ GOOD
interface UserResponse {
  id: number;
  email: string;
}

const data: UserResponse[] = await fetch('/api/users').then(r => r.json());
```

### Naming Conventions

```typescript
// Variables and functions: camelCase
const userName = 'John';
function getUserById(id: number) { }

// Classes and types: PascalCase
class UserService { }
interface UserProfile { }
type UserRole = 'admin' | 'staff';

// Constants: UPPER_SNAKE_CASE
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

// Files:
// - Components: PascalCase (UserProfile.tsx)
// - Utilities: kebab-case (auth-utils.ts)
// - Hooks: camelCase with 'use' prefix (useUser.tsx)
```

### Code Organization

**Keep files focused and small:**

```typescript
// ✅ GOOD: One component per file
// UserProfile.tsx
export function UserProfile({ userId }: { userId: number }) {
  // ...
}

// ❌ BAD: Multiple unrelated components in one file
// components.tsx
export function UserProfile() { }
export function ProjectList() { }
export function Dashboard() { }
```

**Group related functionality:**

```
server/routes/users/
├── index.ts          # Route definitions
├── handlers.ts       # Request handlers
├── validation.ts     # Zod schemas
└── service.ts        # Business logic
```

### Error Handling

**Always handle errors:**

```typescript
// ✅ GOOD: Proper error handling
app.post('/api/users', async (req, res) => {
  try {
    const validated = userSchema.parse(req.body);
    const user = await createUser(validated);
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ❌ BAD: No error handling
app.post('/api/users', async (req, res) => {
  const user = await createUser(req.body); // What if this throws?
  res.json(user);
});
```

### React Best Practices

**Use functional components and hooks:**

```typescript
// ✅ GOOD: Functional component with hooks
export function UserProfile({ userId }: { userId: number }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <div>Loading...</div>;
  return <div>{user.name}</div>;
}

// ❌ BAD: Class component (unless absolutely necessary)
export class UserProfile extends React.Component { }
```

**Extract complex logic to custom hooks:**

```typescript
// ✅ GOOD: Logic in custom hook
function useUserProfile(userId: number) {
  const { data: user } = useQuery(['user', userId], () => fetchUser(userId));
  const { mutate: updateUser } = useMutation(updateUserProfile);

  return { user, updateUser };
}

export function UserProfile({ userId }: { userId: number }) {
  const { user, updateUser } = useUserProfile(userId);
  // ...
}
```

**Keep components small and focused:**

```typescript
// ✅ GOOD: Small, focused components
export function UserProfile() {
  return (
    <div>
      <UserHeader />
      <UserStats />
      <UserActivity />
    </div>
  );
}

// ❌ BAD: Giant component doing everything
export function UserProfile() {
  // 500 lines of JSX...
}
```

### CSS/Styling

**Use Tailwind CSS utility classes:**

```typescript
// ✅ GOOD: Tailwind utilities
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Click me
</button>

// ❌ BAD: Inline styles (avoid unless dynamic)
<button style={{ padding: '8px 16px', backgroundColor: '#3b82f6' }}>
  Click me
</button>
```

**Extract repeated styles to components:**

```typescript
// ✅ GOOD: Reusable Button component
export function Button({ children, variant = 'primary' }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded font-medium';
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  );
}
```

---

## Testing Requirements

### Test Coverage Goals

- **Server code:** 60% minimum, aim for 70%+
- **Client code:** 40% minimum, aim for 60%+
- **Critical paths (auth, permissions):** 90%+ required

### Writing Tests

**Unit tests for business logic:**

```typescript
// tests/unit/auth-utils.test.ts
import { describe, test, expect } from '@jest/globals';
import { hasPermission } from '../shared/unified-auth-utils';

describe('hasPermission', () => {
  test('admin has all permissions', () => {
    const admin = { id: 1, role: 'admin' };
    expect(hasPermission(admin, 'users:delete')).toBe(true);
  });

  test('volunteer cannot delete users', () => {
    const volunteer = { id: 2, role: 'volunteer' };
    expect(hasPermission(volunteer, 'users:delete')).toBe(false);
  });
});
```

**Integration tests for API endpoints:**

```typescript
// tests/integration/routes/users.test.ts
import request from 'supertest';
import { app } from '../../server';

describe('POST /api/users', () => {
  test('creates user with valid data', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'test@example.com',
        password: 'secure123',
        fullName: 'Test User',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toBe('test@example.com');
  });

  test('rejects invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'invalid',
        password: 'secure123',
      });

    expect(response.status).toBe(400);
  });
});
```

**E2E tests for critical workflows:**

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can log in', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('[name="email"]', 'admin@example.com');
  await page.fill('[name="password"]', 'admin123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('text=Welcome')).toBeVisible();
});
```

### Running Tests

```bash
# All tests
npm run test:all

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Watch mode (for TDD)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Requirements for PRs

**Before submitting a PR:**

1. ✅ All existing tests pass
2. ✅ New code has test coverage
3. ✅ No decrease in overall coverage percentage
4. ✅ Critical paths have high coverage (90%+)

---

## Commit Guidelines

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(users): add profile photo upload` |
| `fix` | Bug fix | `fix(auth): resolve session timeout issue` |
| `docs` | Documentation only | `docs(readme): update setup instructions` |
| `style` | Code style (formatting, etc.) | `style(client): fix linting errors` |
| `refactor` | Code change that neither fixes a bug nor adds a feature | `refactor(api): extract validation logic` |
| `perf` | Performance improvement | `perf(db): add index for user queries` |
| `test` | Adding or updating tests | `test(auth): add permission tests` |
| `chore` | Maintenance tasks | `chore(deps): update dependencies` |
| `ci` | CI/CD changes | `ci(github): add test workflow` |

### Examples

```bash
# Feature
git commit -m "feat(messaging): add real-time notifications"

# Bug fix
git commit -m "fix(collections): correct sandwich count calculation"

# Documentation
git commit -m "docs(contributing): add testing guidelines"

# Multi-line commit with body
git commit -m "feat(projects): add project filtering

- Add filter by status
- Add filter by date range
- Update UI with filter controls"

# Breaking change
git commit -m "feat(auth): migrate to JWT authentication

BREAKING CHANGE: Session-based auth replaced with JWT.
Users will need to log in again after deployment."
```

### Commit Best Practices

1. **Atomic commits:** One logical change per commit
2. **Clear descriptions:** Explain what and why, not how
3. **Present tense:** "add feature" not "added feature"
4. **No WIP commits:** Squash before pushing
5. **Reference issues:** Include issue numbers when applicable

```bash
# ✅ GOOD: Atomic, clear commits
git commit -m "feat(users): add email validation"
git commit -m "test(users): add email validation tests"
git commit -m "docs(users): document email validation rules"

# ❌ BAD: Vague, bundled commits
git commit -m "fix stuff"
git commit -m "WIP"
git commit -m "asdf"
```

---

## Pull Request Process

### Before Creating a PR

**Checklist:**

- [ ] Code follows style guide
- [ ] All tests pass (`npm run test:all`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] No linting errors (`npm run lint`)
- [ ] New features have tests
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow guidelines
- [ ] Branch is up to date with main

```bash
# Update your branch
git checkout main
git pull origin main
git checkout your-feature-branch
git merge main
# Resolve any conflicts
npm run test:all
```

### Creating a PR

1. **Push your branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open PR on GitHub**

3. **Fill out PR template:**

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (if applicable)
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Related Issues
Closes #123
```

### PR Review Process

1. **Automated checks run:**
   - TypeScript compilation
   - Linting
   - Tests
   - Coverage

2. **Code review:**
   - Maintainer reviews code
   - May request changes
   - Discussion if needed

3. **Approval:**
   - Once approved, PR can be merged
   - Squash and merge (default)

4. **Post-merge:**
   - CI/CD deploys to production (if configured)
   - Monitor for issues

---

## Documentation

### When to Update Documentation

**Always update docs when you:**

- Add a new feature
- Change behavior
- Modify API endpoints
- Update dependencies
- Fix a bug that others might encounter
- Add new configuration options

### What to Document

**Code comments:**

```typescript
// ✅ GOOD: Comment explains WHY, not WHAT
// We use bcrypt instead of argon2 due to Replit compatibility issues
const hash = await bcrypt.hash(password, 10);

// ❌ BAD: Comment repeats code
// Hash the password
const hash = await bcrypt.hash(password, 10);
```

**README updates:**

- New environment variables
- Setup steps
- Dependencies

**API documentation:**

```typescript
/**
 * Creates a new project.
 *
 * @param {ProjectInput} data - Project data
 * @param {number} userId - Creator's user ID
 * @returns {Promise<Project>} Created project
 * @throws {ValidationError} If data is invalid
 * @throws {PermissionError} If user lacks permission
 */
export async function createProject(data: ProjectInput, userId: number): Promise<Project> {
  // ...
}
```

**Markdown docs:**

Update relevant guides:
- `ARCHITECTURE.md` - For architecture changes
- `TROUBLESHOOTING.md` - For new common issues
- `TESTING.md` - For testing approach changes
- `CONTRIBUTING.md` - For workflow changes

---

## Code Review

### As a Reviewer

**What to look for:**

1. **Correctness:**
   - Does code do what it claims?
   - Are there edge cases not handled?

2. **Tests:**
   - Are critical paths tested?
   - Do tests actually test the behavior?

3. **Security:**
   - Input validation?
   - SQL injection risks?
   - XSS vulnerabilities?
   - Authorization checks?

4. **Performance:**
   - N+1 queries?
   - Unnecessary loops?
   - Large data loads?

5. **Maintainability:**
   - Is code readable?
   - Are names clear?
   - Is it well-organized?

6. **Documentation:**
   - Is complex logic explained?
   - Are docs updated?

**How to give feedback:**

```markdown
# ✅ GOOD: Constructive, specific
The `getUserProjects` function could be optimized by using a join instead of sequential queries. This will prevent N+1 query issues when loading many users.

Suggestion:
```typescript
const projects = await db.query.projects.findMany({
  with: { owner: true },
});
```

# ❌ BAD: Vague, unconstructive
This code is bad. Rewrite it.
```

### As an Author

**Responding to feedback:**

1. **Be open:** Reviewers are trying to help
2. **Ask questions:** If feedback is unclear
3. **Explain:** If reviewer misunderstood
4. **Make changes:** Address valid concerns
5. **Push updates:** Respond to each comment

**Addressing review comments:**

```bash
# Make requested changes
git add .
git commit -m "refactor(users): optimize getUserProjects query"
git push origin feature/your-feature-name

# Comment on PR
# "✅ Fixed N+1 query issue, now using join"
```

---

## Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search closed PRs and issues
3. Ask in GitHub Discussions (if available)
4. Contact maintainer (see HANDOFF.md)

Thank you for contributing to the Sandwich Project Platform!

---

**Revision History:**

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-25 | Claude | Initial creation |
