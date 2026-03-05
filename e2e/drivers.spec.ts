import { test, expect } from '@playwright/test';

// Helper to login before tests
async function login(page: any) {
  await page.goto('/login');
  await page.getByLabel(/email|username/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('testpassword');
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL(/\/(dashboard|home)/i);
}

test.describe('Driver Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display drivers list', async ({ page }) => {
    await page.goto('/drivers');

    await expect(
      page.getByRole('heading', { name: /drivers/i })
    ).toBeVisible();

    // Should have add driver button
    await expect(
      page.getByRole('button', { name: /add driver|new driver|create driver/i })
    ).toBeVisible();
  });

  test('should open driver creation form', async ({ page }) => {
    await page.goto('/drivers');

    await page
      .getByRole('button', { name: /add driver|new driver|create driver/i })
      .click();

    // Form should be visible
    await expect(page.getByLabel(/name|driver name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/phone/i)).toBeVisible();
  });

  test('should create a new driver', async ({ page }) => {
    await page.goto('/drivers');

    await page
      .getByRole('button', { name: /add driver|new driver|create driver/i })
      .click();

    // Fill out the form
    await page.getByLabel(/name|driver name/i).fill('John Doe');
    await page.getByLabel(/email/i).fill('john.doe@example.com');
    await page.getByLabel(/phone/i).fill('555-0100');

    // Fill additional fields if they exist
    const licenseField = page.getByLabel(/license|driver.*license/i);
    if (await licenseField.isVisible()) {
      await licenseField.fill('DL123456');
    }

    const vehicleField = page.getByLabel(/vehicle|car/i);
    if (await vehicleField.isVisible()) {
      await vehicleField.fill('Toyota Camry');
    }

    // Submit the form
    await page.getByRole('button', { name: /submit|create|save|add/i }).click();

    // Should show success message
    await expect(
      page.locator('text=/success|created|added/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/drivers');

    await page
      .getByRole('button', { name: /add driver|new driver|create driver/i })
      .click();

    await page.getByLabel(/name|driver name/i).fill('Test Driver');
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/phone/i).fill('555-0100');

    await page.getByRole('button', { name: /submit|create|save/i }).click();

    // Should show validation error
    await expect(
      page.locator('text=/invalid email|valid email/i')
    ).toBeVisible();
  });

  test('should validate phone format', async ({ page }) => {
    await page.goto('/drivers');

    await page
      .getByRole('button', { name: /add driver|new driver|create driver/i })
      .click();

    await page.getByLabel(/name|driver name/i).fill('Test Driver');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/phone/i).fill('invalid');

    await page.getByRole('button', { name: /submit|create|save/i }).click();

    // Should show validation error
    await expect(
      page.locator('text=/invalid phone|valid phone/i')
    ).toBeVisible();
  });

  test('should view driver details', async ({ page }) => {
    await page.goto('/drivers');

    // Click on first driver
    const firstDriver = page
      .locator('[data-testid="driver-item"], tr, .driver-card')
      .first();

    if (await firstDriver.isVisible()) {
      await firstDriver.click();

      // Should show driver details
      await expect(
        page.getByRole('heading', { name: /driver.*details|details/i })
      ).toBeVisible({ timeout: 3000 });
    }
  });

  test('should edit a driver', async ({ page }) => {
    await page.goto('/drivers');

    // Find edit button
    const editButton = page
      .getByRole('button', { name: /edit/i })
      .first();

    if (await editButton.isVisible()) {
      await editButton.click();

      // Should show edit form
      const nameField = page.getByLabel(/name|driver name/i);
      await expect(nameField).toBeVisible();

      // Make a change
      await nameField.clear();
      await nameField.fill('Updated Driver Name');

      // Save changes
      await page.getByRole('button', { name: /save|update/i }).click();

      // Should show success message
      await expect(
        page.locator('text=/updated|saved|success/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should deactivate a driver', async ({ page }) => {
    await page.goto('/drivers');

    // Find deactivate/disable button
    const deactivateButton = page
      .getByRole('button', { name: /deactivate|disable|inactive/i })
      .first();

    if (await deactivateButton.isVisible()) {
      await deactivateButton.click();

      // May need confirmation
      const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Should show success message
      await expect(
        page.locator('text=/deactivated|disabled|inactive|success/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should search for drivers', async ({ page }) => {
    await page.goto('/drivers');

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('John');
      await page.keyboard.press('Enter');

      // Wait for search results
      await page.waitForTimeout(1000);
    }
  });

  test('should filter drivers by status', async ({ page }) => {
    await page.goto('/drivers');

    const statusFilter = page.getByLabel(/status|filter/i);
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option', { name: /active/i }).click();

      // Wait for filtered results
      await page.waitForTimeout(1000);
    }
  });

  test('should view driver assignments', async ({ page }) => {
    await page.goto('/drivers');

    // Click on first driver to view details
    const firstDriver = page
      .locator('[data-testid="driver-item"], tr, .driver-card')
      .first();

    if (await firstDriver.isVisible()) {
      await firstDriver.click();

      // Look for assignments tab or section
      const assignmentsTab = page.getByRole('tab', { name: /assignments/i });
      if (await assignmentsTab.isVisible()) {
        await assignmentsTab.click();

        // Should show assignments list
        await expect(
          page.getByRole('heading', { name: /assignments/i })
        ).toBeVisible();
      }
    }
  });

  test('should assign driver to an event', async ({ page }) => {
    await page.goto('/drivers');

    // Find assign button
    const assignButton = page
      .getByRole('button', { name: /assign/i })
      .first();

    if (await assignButton.isVisible()) {
      await assignButton.click();

      // Should show assignment form or modal
      const eventSelect = page.getByLabel(/event|select event/i);
      if (await eventSelect.isVisible()) {
        await eventSelect.click();
        // Select first event
        await page.getByRole('option').first().click();

        // Confirm assignment
        await page.getByRole('button', { name: /assign|confirm/i }).click();

        // Should show success message
        await expect(
          page.locator('text=/assigned|success/i')
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should export drivers list', async ({ page }) => {
    await page.goto('/drivers');

    const exportButton = page.getByRole('button', { name: /export|download/i });
    if (await exportButton.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/drivers|export/i);
    }
  });

  test('should display driver statistics', async ({ page }) => {
    await page.goto('/drivers');

    // Look for statistics section
    const statsSection = page.locator('[data-testid="driver-stats"], .stats, .statistics');
    if (await statsSection.isVisible()) {
      // Should show some metrics
      await expect(
        statsSection.locator('text=/total|active|available/i')
      ).toBeVisible();
    }
  });
});

test.describe('Driver Availability', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/drivers');
  });

  test('should update driver availability', async ({ page }) => {
    // Click on first driver
    const firstDriver = page
      .locator('[data-testid="driver-item"], tr, .driver-card')
      .first();

    if (await firstDriver.isVisible()) {
      await firstDriver.click();

      // Look for availability section
      const availabilityButton = page.getByRole('button', { name: /availability|schedule/i });
      if (await availabilityButton.isVisible()) {
        await availabilityButton.click();

        // Toggle some availability
        const mondayCheckbox = page.getByLabel(/monday/i);
        if (await mondayCheckbox.isVisible()) {
          await mondayCheckbox.click();
        }

        // Save changes
        await page.getByRole('button', { name: /save|update/i }).click();

        // Should show success
        await expect(
          page.locator('text=/updated|saved|success/i')
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
