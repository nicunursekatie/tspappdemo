-- Migration: Add driver agreement signed field to host contacts
-- Date: 2026-01-15
-- Description: Track whether a host contact has signed the driver agreement

-- Add driver_agreement_signed column with default false
ALTER TABLE host_contacts
ADD COLUMN IF NOT EXISTS driver_agreement_signed BOOLEAN DEFAULT false;

-- Comment explaining the field
COMMENT ON COLUMN host_contacts.driver_agreement_signed IS
'Whether this host contact has signed the driver agreement form';
