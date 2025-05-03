/*
  # Fix Permissions System
  
  1. Changes
    - Reset all permissions
    - Set up correct permission levels
    - Add proper constraints
    - Update permission checking functions
*/

-- First, clear existing permissions to start fresh
TRUNCATE position_permissions CASCADE;

-- Insert base permissions for each position level
DO $$
DECLARE
  v_agent_id uuid;
  v_senior_agent_id uuid;
  v_manager_id uuid;
  v_admin_id uuid;
  v_owner_id uuid;
BEGIN
  -- Get position IDs
  SELECT id INTO v_agent_id FROM positions WHERE name = 'agent';
  SELECT id INTO v_senior_agent_id FROM positions WHERE name = 'senior_agent';
  SELECT id INTO v_manager_id FROM positions WHERE name = 'manager';
  SELECT id INTO v_admin_id FROM positions WHERE name = 'admin';
  SELECT id INTO v_owner_id FROM positions WHERE name = 'owner';

  -- Agent permissions (Level 1)
  INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete) VALUES
    (v_agent_id, 'dashboard', true, false, false),
    (v_agent_id, 'post-deal', true, true, false),
    (v_agent_id, 'book', true, false, false),
    (v_agent_id, 'settings', true, true, false);

  -- Senior Agent permissions (Level 2)
  INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete) VALUES
    (v_senior_agent_id, 'dashboard', true, false, false),
    (v_senior_agent_id, 'post-deal', true, true, false),
    (v_senior_agent_id, 'book', true, true, false),
    (v_senior_agent_id, 'settings', true, true, false);

  -- Manager permissions (Level 3)
  INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete) VALUES
    (v_manager_id, 'dashboard', true, true, false),
    (v_manager_id, 'post-deal', true, true, true),
    (v_manager_id, 'book', true, true, false),
    (v_manager_id, 'agents', true, false, false),
    (v_manager_id, 'settings', true, true, false);

  -- Admin permissions (Level 4)
  INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete) VALUES
    (v_admin_id, 'dashboard', true, true, true),
    (v_admin_id, 'post-deal', true, true, true),
    (v_admin_id, 'book', true, true, true),
    (v_admin_id, 'agents', true, true, true),
    (v_admin_id, 'configuration', true, true, true),
    (v_admin_id, 'monitoring', true, true, true),
    (v_admin_id, 'settings', true, true, true);

  -- Owner permissions (Level 5) - Full access to everything
  INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete) VALUES
    (v_owner_id, 'dashboard', true, true, true),
    (v_owner_id, 'post-deal', true, true, true),
    (v_owner_id, 'book', true, true, true),
    (v_owner_id, 'agents', true, true, true),
    (v_owner_id, 'configuration', true, true, true),
    (v_owner_id, 'monitoring', true, true, true),
    (v_owner_id, 'settings', true, true, true);
END $$;

-- Update the get_position_permissions function to be more strict
CREATE OR REPLACE FUNCTION get_position_permissions(p_position_id uuid)
RETURNS TABLE (
  section text,
  can_view boolean,
  can_edit boolean,
  can_delete boolean
) AS $$
BEGIN
  -- Return the actual permissions from the table
  RETURN QUERY
  SELECT 
    pp.section,
    pp.can_view,
    pp.can_edit,
    pp.can_delete
  FROM position_permissions pp
  WHERE pp.position_id = p_position_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if a user has access to a section
CREATE OR REPLACE FUNCTION has_section_access(
  p_user_id uuid,
  p_section text,
  p_action text DEFAULT 'view'
)
RETURNS boolean AS $$
DECLARE
  v_position_id uuid;
BEGIN
  -- Get user's position
  SELECT position_id INTO v_position_id
  FROM users
  WHERE id = p_user_id;

  IF v_position_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check permission
  RETURN EXISTS (
    SELECT 1 
    FROM position_permissions
    WHERE position_id = v_position_id 
    AND section = p_section
    AND CASE 
      WHEN p_action = 'view' THEN can_view
      WHEN p_action = 'edit' THEN can_edit
      WHEN p_action = 'delete' THEN can_delete
      ELSE false
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;