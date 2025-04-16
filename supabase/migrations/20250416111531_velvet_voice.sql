/*
  # Add Agent Management Fields

  1. New Tables
    - `permission_levels`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text, nullable)
      - `created_at` (timestamp)

  2. Changes to Existing Tables
    - Add to `users` table:
      - `national_producer_number` (text, nullable)
      - `annual_goal` (numeric, nullable)
      - `permission_level_id` (uuid, references permission_levels)
      - `phone` (text, nullable)

  3. Security
    - Enable RLS on permission_levels table
    - Add policy for authenticated users to read permission levels
*/

-- Create permission_levels table
CREATE TABLE IF NOT EXISTS permission_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Add RLS to permission_levels
ALTER TABLE permission_levels ENABLE ROW LEVEL SECURITY;

-- Add policy for reading permission levels
CREATE POLICY "Anyone can read permission levels"
  ON permission_levels
  FOR SELECT
  TO authenticated
  USING (true);

-- Add new columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS national_producer_number text,
ADD COLUMN IF NOT EXISTS annual_goal numeric(10,2),
ADD COLUMN IF NOT EXISTS permission_level_id uuid REFERENCES permission_levels(id),
ADD COLUMN IF NOT EXISTS phone text;

-- Insert default permission levels
INSERT INTO permission_levels (name, description)
VALUES 
  ('admin', 'Full system access'),
  ('manager', 'Team management and reporting'),
  ('agent', 'Basic agent access')
ON CONFLICT (name) DO NOTHING;

-- Create index for permission level lookups
CREATE INDEX IF NOT EXISTS idx_users_permission_level_id 
ON users(permission_level_id);