-- Migration: Enhanced Driver Availability System
-- Date: 2026-01-16
-- Description: Add new fields to support scheduled unavailability with check-in dates
--
-- New fields:
-- - availability_status: 'available', 'unavailable', 'pending_checkin', 'inactive'
-- - unavailable_start_date: When driver becomes unavailable (for scheduling future unavailability)
-- - check_in_date: When admin should reach out to see if driver is ready to return
-- - unavailable_reason: Why they're unavailable (medical, travel, personal, work conflict)

-- Add availability_status column with default 'available'
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available';

-- Add unavailable_start_date column for scheduling future unavailability
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS unavailable_start_date TIMESTAMP;

-- Add check_in_date column for admin follow-up reminders
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS check_in_date TIMESTAMP;

-- Add unavailable_reason column to track why driver is unavailable
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS unavailable_reason TEXT;

-- Migrate existing temporarily_unavailable drivers to new status system
-- Drivers marked as temporarily unavailable become 'unavailable'
-- Drivers who are NOT active become 'inactive'
UPDATE drivers
SET availability_status = CASE
  WHEN is_active = false THEN 'inactive'
  WHEN temporarily_unavailable = true THEN 'unavailable'
  ELSE 'available'
END
WHERE availability_status IS NULL OR availability_status = 'available';

-- Comment explaining the status values
COMMENT ON COLUMN drivers.availability_status IS
'Driver availability state machine: available (can be scheduled), unavailable (temporarily out), pending_checkin (past check-in date, needs admin outreach), inactive (permanently unavailable/retired)';
