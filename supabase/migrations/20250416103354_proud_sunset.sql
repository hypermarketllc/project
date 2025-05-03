/*
  # Update Settings Schema
  
  1. Changes
    - Drop existing settings table
    - Create new settings table without RLS
    - Add initial system settings
*/

-- Drop existing settings table if it exists
DROP TABLE IF EXISTS settings;

-- Create new settings table without RLS
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert initial system settings
INSERT INTO settings (key, value, description)
VALUES (
  'system_settings',
  '{
    "name": "MyAgentView",
    "advance_rate_default": 0.75,
    "collect_client_info": true,
    "collect_policy_info": true,
    "require_carrier_agent_numbers": false,
    "allow_split_commissions": true,
    "payouts_enabled": true,
    "book_enabled": true
  }',
  'System-wide settings'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;