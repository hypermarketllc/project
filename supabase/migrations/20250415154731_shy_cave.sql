/*
  # Create settings table

  1. New Tables
    - `settings`
      - `id` (uuid, primary key)
      - `key` (text, unique)
      - `value` (jsonb, allows for storing any JSON value)
      - `description` (text, nullable)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)
*/

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert some default settings
INSERT INTO settings (key, value, description)
VALUES 
  ('commission_rates', '{"default": 10, "senior": 15, "manager": 20}', 'Default commission rates by position level'),
  ('payout_schedule', '{"frequency": "monthly", "day": 15}', 'Commission payout schedule configuration'),
  ('minimum_deal_amount', '100', 'Minimum deal amount required for commission calculation')
ON CONFLICT (key) DO NOTHING;