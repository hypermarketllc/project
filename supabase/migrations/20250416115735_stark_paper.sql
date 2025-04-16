/*
  # Fix users/agents table structure and relationships

  1. Changes
    - Drop existing constraints and indexes safely
    - Add missing columns and constraints
    - Update foreign key relationships
    - Add proper indexes for performance
  
  2. Security
    - Temporarily disable RLS for data migration
*/

-- First, ensure we can modify the constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key CASCADE;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey CASCADE;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_position_id_fkey CASCADE;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_permission_level_id_fkey CASCADE;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_upline_id_fkey CASCADE;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_users_position_id;
DROP INDEX IF EXISTS idx_users_upline_id;
DROP INDEX IF EXISTS idx_users_permission_level_id;

-- Recreate primary key and unique constraints
ALTER TABLE users
  ADD CONSTRAINT users_pkey PRIMARY KEY (id),
  ADD CONSTRAINT users_email_key UNIQUE (email);

-- Add foreign key constraints
ALTER TABLE users
  ADD CONSTRAINT users_position_id_fkey FOREIGN KEY (position_id) REFERENCES positions(id),
  ADD CONSTRAINT users_permission_level_id_fkey FOREIGN KEY (permission_level_id) REFERENCES permission_levels(id),
  ADD CONSTRAINT users_upline_id_fkey FOREIGN KEY (upline_id) REFERENCES users(id);

-- Create indexes for better query performance
CREATE INDEX idx_users_position_id ON users(position_id);
CREATE INDEX idx_users_upline_id ON users(upline_id);
CREATE INDEX idx_users_permission_level_id ON users(permission_level_id);

-- Update deals and commissions constraints
ALTER TABLE deals
  DROP CONSTRAINT IF EXISTS deals_agent_id_fkey CASCADE,
  ADD CONSTRAINT deals_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES users(id);

ALTER TABLE commissions
  DROP CONSTRAINT IF EXISTS commissions_user_id_fkey CASCADE,
  ADD CONSTRAINT commissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- Ensure all timestamp columns have proper defaults
ALTER TABLE users 
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();