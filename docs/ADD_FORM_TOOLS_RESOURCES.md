# Adding Form Tools to Resources

The Auto Form Filler and Service Hours Form Generator have been added to the platform and are accessible via the sidebar navigation. To also display them as resource cards on the Resources page, you have three options:

## Option 1: Run the Automated Script (Recommended)

Run this command from the project root:

```bash
npx tsx server/scripts/add-form-tools-resources.ts
```

This will automatically add both tools to the Resources database with proper tagging.

## Option 2: Run Full Resources Seed

If you want to reseed all resources (including these new tools):

```bash
npx tsx server/scripts/seed-resources.ts
```

## Option 3: Add Manually Through Admin UI

1. Log in as an admin user
2. Navigate to **Resources** page
3. Click the **"Add Resource"** button
4. Add the following resources:

### Auto Form Filler

- **Title:** Auto Form Filler
- **Description:** AI-powered tool to automatically fill out TSP forms by uploading documents. Supports Service Hours Forms, Event Requests, Volunteer Applications, and more.
- **Type:** Link
- **Category:** Forms & Templates
- **URL:** `/dashboard?section=auto-form-filler`
- **Tags:** Forms

### Service Hours Form Generator

- **Title:** Service Hours Form Generator
- **Description:** Quickly generate filled Community Service Hours verification forms for volunteers with automatic PDF creation.
- **Type:** Link
- **Category:** Forms & Templates
- **URL:** `/dashboard?section=generate-service-hours`
- **Tags:** Forms

## What This Adds

After adding these resources, users will be able to access these tools from:

1. **Resources Tab** - Under the "Forms & Templates" category as clickable resource cards
2. **Sidebar Navigation** - Under the "Documentation" section (already configured)

Both locations will work seamlessly, giving users multiple ways to discover and access these powerful form automation tools.
