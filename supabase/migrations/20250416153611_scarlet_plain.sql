/*
  # Add submission date to deals table
  
  1. Changes
    - Add submitted_at column to store when the deal was posted
    - Add index for better query performance
*/

ALTER TABLE deals
ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_deals_submitted_at ON deals(submitted_at);