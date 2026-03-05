-- Migration: Add address and geocoding fields to users table
-- Date: 2026-02-20
-- Description: Allow team members to save their home address and display on the driver planning map

ALTER TABLE users
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS latitude VARCHAR;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS longitude VARCHAR;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP;

COMMENT ON COLUMN users.address IS 'Home address for map display in driver planning tool';
COMMENT ON COLUMN users.latitude IS 'Geocoded latitude for map display';
COMMENT ON COLUMN users.longitude IS 'Geocoded longitude for map display';
COMMENT ON COLUMN users.geocoded_at IS 'When coordinates were last geocoded';
