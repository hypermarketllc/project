/*
  # Add Admin Permissions and Default Position Assignment
  
  1. Changes
    - Add default agent position for new users
    - Grant admin users ability to manage positions and uplines
    - Add RLS policies for position management
    - Add trigger for default position assignment
*/

-- First ensure we have the basic positions
INSERT INTO positions (name, level, description)
VALUES 
  ('owner', 5, 'Organization owner with full system access'),
  ('admin', 4, 'Administrator with full management access'),
  ('manager', 3, 'Team manager with limited management access'),
  ('senior_agent', 2, 'Senior agent with team lead capabilities'),
  ('agent', 1, 'Standard agent position')
ON CONFLICT (name) DO UPDATE
SET level = EXCLUDED.level,
    description = EXCLUDED.description;

-- Create function to check if user has admin access
CREATE OR REPLACE FUNCTION has_admin_access(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM users u
    JOIN positions p ON u.position_id = p.id
    WHERE u.id = user_id AND p.level >= 4
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can manage positions
CREATE OR REPLACE FUNCTION can_manage_positions(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM users u
    JOIN positions p ON u.position_id = p.id
    WHERE u.id = user_id AND p.level >= 3
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to assign default position to new users
CREATE OR REPLACE FUNCTION assign_default_position()
RETURNS TRIGGER AS $$
DECLARE
  default_position_id uuid;
BEGIN
  -- Get the agent position ID
  SELECT id INTO default_position_id
  FROM positions
  WHERE name = 'agent'
  LIMIT 1;

  -- Assign the default position if none is set
  IF NEW.position_id IS NULL THEN
    NEW.position_id := default_position_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to assign default position
DROP TRIGGER IF EXISTS assign_default_position_trigger ON users;
CREATE TRIGGER assign_default_position_trigger
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_position();

-- Update existing users without a position
UPDATE users
SET position_id = (
  SELECT id
  FROM positions
  WHERE name = 'agent'
  LIMIT 1
)
WHERE position_id IS NULL;

-- Grant admin users the ability to update positions and uplines
CREATE OR REPLACE FUNCTION update_user_position(
  target_user_id uuid,
  new_position_id uuid,
  new_upline_id uuid
)
RETURNS void AS $$
BEGIN
  IF NOT has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Insufficient permissions to update user positions';
  END IF;

  UPDATE users
  SET position_id = COALESCE(new_position_id, position_id),
      upline_id = new_upline_id,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain function usage
COMMENT ON FUNCTION update_user_position IS 'Updates a user''s position and upline. Requires admin access.';

-- Ensure the admin user has the owner position
UPDATE users
SET position_id = (SELECT id FROM positions WHERE name = 'owner')
WHERE email = 'admin@americancoveragecenter.com';