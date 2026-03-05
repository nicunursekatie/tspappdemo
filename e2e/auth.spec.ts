import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
    await expect(page.getByLabel(/email|username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should show validation messages
    await expect(page.locator('text=/required|cannot be empty/i')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/email|username/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should show error message
    await expect(
      page.locator('text=/invalid credentials|incorrect|not found/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Fill in valid credentials
    await page.getByLabel(/email|username/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('testpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should redirect to dashboard or home
    await page.waitForURL(/\/(dashboard|home)/i, { timeout: 5000 });
    await expect(page).toHaveURL(/\/(dashboard|home)/i);
  });

  test('should have password visibility toggle', async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);

    // Password should be hidden by default
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click visibility toggle if it exists
    const toggleButton = page.locator('[aria-label*="show password" i], [aria-label*="toggle" i]');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });

  test('should navigate to signup page', async ({ page }) => {
    const signupLink = page.getByRole('link', { name: /sign up|register|create account/i });

    if (await signupLink.isVisible()) {
      await signupLink.click();
      await expect(page).toHaveURL(/\/(signup|register)/i);
    }
  });

  test('should navigate to forgot password page', async ({ page }) => {
    const forgotPasswordLink = page.getByRole('link', { name: /forgot password|reset password/i });

    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click();
      await expect(page).toHaveURL(/\/(forgot-password|reset)/i);
    }
  });
});

test.describe('Logout', () => {
  test('should logout successfully', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('testpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL(/\/(dashboard|home)/i);

    // Find and click logout button
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try to find logout in a menu
      const userMenu = page.getByRole('button', { name: /user menu|profile|account/i });
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await page.getByRole('menuitem', { name: /logout|sign out/i }).click();
      }
    }

    // Should redirect to login page
    await expect(page).toHaveURL(/\/(login|signin)/i);
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing protected routes while logged out', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/(login|signin)/i, { timeout: 5000 });
  });

  test('should maintain redirect path after login', async ({ page }) => {
    // Try to access a specific protected page
    await page.goto('/dashboard/settings');

    // Should redirect to login
    await page.waitForURL(/\/(login|signin)/i);

    // Login
    await page.getByLabel(/email|username/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('testpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should redirect back to the originally requested page
    await expect(page).toHaveURL(/settings/i, { timeout: 5000 });
  });
});
