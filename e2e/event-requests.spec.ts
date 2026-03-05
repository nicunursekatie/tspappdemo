import { test, expect } from '@playwright/test';

// Helper to login before tests
async function login(page: any) {
  await page.goto('/login');
  await page.getByLabel(/email|username/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('testpassword');
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL(/\/(dashboard|home)/i);
}

test.describe('Event Requests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display event requests list', async ({ page }) => {
    await page.goto('/event-requests');

    // Should show event requests page
    await expect(
      page.getByRole('heading', { name: /event requests|events/i })
    ).toBeVisible();

    // Should have a button to create new event
    await expect(
      page.getByRole('button', { name: /new event|create event|add event/i })
    ).toBeVisible();
  });

  test('should open event creation form', async ({ page }) => {
    await page.goto('/event-requests');

    await page
      .getByRole('button', { name: /new event|create event|add event/i })
      .click();

    // Form should be visible
    await expect(page.getByLabel(/title|event name/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByLabel(/date|event date/i)).toBeVisible();
  });

  test('should validate required fields on event creation', async ({ page }) => {
    await page.goto('/event-requests');

    await page
      .getByRole('button', { name: /new event|create event|add event/i })
      .click();

    // Try to submit empty form
    await page.getByRole('button', { name: /submit|create|save/i }).click();

    // Should show validation errors
    await expect(page.locator('text=/required|cannot be empty/i')).toBeVisible();
  });

  test('should create a new event request', async ({ page }) => {
    await page.goto('/event-requests');

    await page
      .getByRole('button', { name: /new event|create event|add event/i })
      .click();

    // Fill out the form
    await page.getByLabel(/title|event name/i).fill('Community Meal');
    await page.getByLabel(/description/i).fill('Weekly community meal service');

    // Select a future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateString = futureDate.toISOString().split('T')[0];
    await page.getByLabel(/date|event date/i).fill(dateString);

    // Fill location if available
    const locationField = page.getByLabel(/location/i);
    if (await locationField.isVisible()) {
      await locationField.fill('Community Center');
    }

    // Fill estimated attendees if available
    const attendeesField = page.getByLabel(/attendees|participants/i);
    if (await attendeesField.isVisible()) {
      await attendeesField.fill('50');
    }

    // Submit the form
    await page.getByRole('button', { name: /submit|create|save/i }).click();

    // Should show success message or redirect
    await expect(
      page.locator('text=/success|created|submitted/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should filter event requests by status', async ({ page }) => {
    await page.goto('/event-requests');

    // Look for filter/status dropdown
    const statusFilter = page.getByLabel(/status|filter/i);
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option', { name: /pending/i }).click();

      // Wait for filtered results
      await page.waitForTimeout(1000);

      // Check that we're on the filtered view
      await expect(page).toHaveURL(/status=pending/i);
    }
  });

  test('should view event request details', async ({ page }) => {
    await page.goto('/event-requests');

    // Find and click the first event request
    const firstEvent = page
      .locator('[data-testid="event-request-item"], tr, .event-card')
      .first();

    if (await firstEvent.isVisible()) {
      await firstEvent.click();

      // Should show event details
      await expect(
        page.getByRole('heading', { name: /details|event/i })
      ).toBeVisible({ timeout: 3000 });
    }
  });

  test('should edit an event request', async ({ page }) => {
    await page.goto('/event-requests');

    // Find edit button for first event
    const editButton = page
      .getByRole('button', { name: /edit/i })
      .first();

    if (await editButton.isVisible()) {
      await editButton.click();

      // Should show edit form
      const titleField = page.getByLabel(/title|event name/i);
      await expect(titleField).toBeVisible();

      // Make a change
      await titleField.clear();
      await titleField.fill('Updated Event Title');

      // Save changes
      await page.getByRole('button', { name: /save|update/i }).click();

      // Should show success message
      await expect(
        page.locator('text=/updated|saved|success/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should approve an event request (admin only)', async ({ page }) => {
    await page.goto('/event-requests');

    // Find approve button
    const approveButton = page
      .getByRole('button', { name: /approve/i })
      .first();

    if (await approveButton.isVisible()) {
      await approveButton.click();

      // May need confirmation
      const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Should show success message
      await expect(
        page.locator('text=/approved|success/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should delete an event request', async ({ page }) => {
    await page.goto('/event-requests');

    // Find delete button
    const deleteButton = page
      .getByRole('button', { name: /delete|remove/i })
      .first();

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Should show confirmation dialog
      await expect(
        page.locator('text=/are you sure|confirm delete/i')
      ).toBeVisible();

      // Confirm deletion
      await page.getByRole('button', { name: /confirm|yes|delete/i }).click();

      // Should show success message
      await expect(
        page.locator('text=/deleted|removed|success/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should search event requests', async ({ page }) => {
    await page.goto('/event-requests');

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('community');
      await page.keyboard.press('Enter');

      // Wait for search results
      await page.waitForTimeout(1000);

      // URL should contain search parameter
      await expect(page).toHaveURL(/search=community/i);
    }
  });

  test('should paginate through event requests', async ({ page }) => {
    await page.goto('/event-requests');

    const nextButton = page.getByRole('button', { name: /next|>/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Should be on page 2
      await expect(page).toHaveURL(/page=2/i);

      // Previous button should now be visible
      const prevButton = page.getByRole('button', { name: /previous|</i });
      await expect(prevButton).toBeVisible();
    }
  });
});

test.describe('Event Request Validation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/event-requests');
    await page
      .getByRole('button', { name: /new event|create event|add event/i })
      .click();
  });

  test('should validate date is in the future', async ({ page }) => {
    await page.getByLabel(/title|event name/i).fill('Test Event');
    await page.getByLabel(/description/i).fill('Test description');

    // Try to set a past date
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    const dateString = pastDate.toISOString().split('T')[0];
    await page.getByLabel(/date|event date/i).fill(dateString);

    await page.getByRole('button', { name: /submit|create|save/i }).click();

    // Should show validation error
    await expect(
      page.locator('text=/future|past|invalid date/i')
    ).toBeVisible();
  });

  test('should validate attendee count is positive', async ({ page }) => {
    const attendeesField = page.getByLabel(/attendees|participants/i);
    if (await attendeesField.isVisible()) {
      await attendeesField.fill('-10');

      await page.getByRole('button', { name: /submit|create|save/i }).click();

      // Should show validation error
      await expect(
        page.locator('text=/positive|greater than|invalid/i')
      ).toBeVisible();
    }
  });
});
