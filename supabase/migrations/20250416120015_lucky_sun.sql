/*
  # Fix agents table structure and relationships

  1. Changes
    - Ensure all foreign key relationships are correct
    - Add missing indexes
    - Update column defaults
    - Fix any remaining constraint issues
  
  2. Security
    - Temporarily disable RLS for data migration
*/

-- Drop and recreate foreign key constraints to ensure clean state
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_position_id_fkey CASCADE;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_permission_level_id_fkey CASCADE;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_upline_id_fkey CASCADE;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_agent_id_fkey CASCADE;
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_user_id_fkey CASCADE;

-- Recreate foreign key constraints with proper references
ALTER TABLE users
  ADD CONSTRAINT users_position_id_fkey FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
  ADD CONSTRAINT users_permission_level_id_fkey FOREIGN KEY (permission_level_id) REFERENCES permission_levels(id) ON DELETE SET NULL,
  ADD CONSTRAINT users_upline_id_fkey FOREIGN KEY (upline_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE deals
  ADD CONSTRAINT deals_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE commissions
  ADD CONSTRAINT commissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Ensure all required indexes exist
CREATE INDEX IF NOT EXISTS idx_users_position_id ON users(position_id);
CREATE INDEX IF NOT EXISTS idx_users_upline_id ON users(upline_id);
CREATE INDEX IF NOT EXISTS idx_users_permission_level_id ON users(permission_level_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name);

-- Update column defaults and constraints
ALTER TABLE users
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN is_active SET DEFAULT true;

-- Ensure the updated_at trigger exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default permission levels if they don't exist
INSERT INTO permission_levels (name, description)
VALUES 
  ('admin', 'Full system access'),
  ('manager', 'Team management and reporting'),
  ('agent', 'Basic agent access')
ON CONFLICT (name) DO NOTHING;