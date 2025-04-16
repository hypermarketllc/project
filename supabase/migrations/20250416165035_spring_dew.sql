/*
  # Add Position Permissions System
  
  1. New Tables
    - `position_permissions`
      - `id` (uuid, primary key)
      - `position_id` (uuid, references positions)
      - `section` (text, the section/route name)
      - `can_view` (boolean)
      - `can_edit` (boolean)
      - `can_delete` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Functions
    - check_position_permission: Function to check if a position has access to a section
    - get_user_permissions: Function to get all permissions for a user
*/

-- Create position_permissions table
CREATE TABLE IF NOT EXISTS position_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES positions(id) ON DELETE CASCADE,
  section text NOT NULL,
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(position_id, section)
);

-- Create function to check permission
CREATE OR REPLACE FUNCTION check_position_permission(
  p_position_id uuid,
  p_section text,
  p_action text DEFAULT 'view'
)
RETURNS boolean AS $$
BEGIN
  -- Owner position (level 5) always has full access
  IF EXISTS (
    SELECT 1 FROM positions 
    WHERE id = p_position_id AND level = 5
  ) THEN
    RETURN true;
  END IF;

  -- Check specific permission
  RETURN EXISTS (
    SELECT 1 
    FROM position_permissions
    WHERE position_id = p_position_id 
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

-- Create function to get all permissions for a position
CREATE OR REPLACE FUNCTION get_position_permissions(p_position_id uuid)
RETURNS TABLE (
  section text,
  can_view boolean,
  can_edit boolean,
  can_delete boolean
) AS $$
BEGIN
  -- If owner position, return full access to all sections
  IF EXISTS (
    SELECT 1 FROM positions 
    WHERE id = p_position_id AND level = 5
  ) THEN
    RETURN QUERY
    SELECT 
      section,
      true as can_view,
      true as can_edit,
      true as can_delete
    FROM (
      SELECT unnest(ARRAY[
        'dashboard',
        'post-deal',
        'agents',
        'book',
        'configuration',
        'monitoring',
        'settings'
      ]) as section
    ) sections;
  ELSE
    -- Return actual permissions
    RETURN QUERY
    SELECT 
      pp.section,
      pp.can_view,
      pp.can_edit,
      pp.can_delete
    FROM position_permissions pp
    WHERE pp.position_id = p_position_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default permissions for each position
DO $$
DECLARE
  v_agent_id uuid;
  v_senior_agent_id uuid;
  v_manager_id uuid;
  v_admin_id uuid;
BEGIN
  -- Get position IDs
  SELECT id INTO v_agent_id FROM positions WHERE name = 'agent';
  SELECT id INTO v_senior_agent_id FROM positions WHERE name = 'senior_agent';
  SELECT id INTO v_manager_id FROM positions WHERE name = 'manager';
  SELECT id INTO v_admin_id FROM positions WHERE name = 'admin';

  -- Agent permissions
  INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete) VALUES
    (v_agent_id, 'dashboard', true, false, false),
    (v_agent_id, 'post-deal', true, true, false),
    (v_agent_id, 'book', true, false, false),
    (v_agent_id, 'settings', true, true, false)
  ON CONFLICT (position_id, section) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit,
      can_delete = EXCLUDED.can_delete;

  -- Senior Agent permissions
  INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete) VALUES
    (v_senior_agent_id, 'dashboard', true, false, false),
    (v_senior_agent_id, 'post-deal', true, true, true),
    (v_senior_agent_id, 'book', true, true, false),
    (v_senior_agent_id, 'agents', true, false, false),
    (v_senior_agent_id, 'settings', true, true, false)
  ON CONFLICT (position_id, section) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit,
      can_delete = EXCLUDED.can_delete;

  -- Manager permissions
  INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete) VALUES
    (v_manager_id, 'dashboard', true, true, false),
    (v_manager_id, 'post-deal', true, true, true),
    (v_manager_id, 'book', true, true, true),
    (v_manager_id, 'agents', true, true, false),
    (v_manager_id, 'configuration', true, true, false),
    (v_manager_id, 'settings', true, true, false)
  ON CONFLICT (position_id, section) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit,
      can_delete = EXCLUDED.can_delete;

  -- Admin permissions (full access except owner-only functions)
  INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete) VALUES
    (v_admin_id, 'dashboard', true, true, true),
    (v_admin_id, 'post-deal', true, true, true),
    (v_admin_id, 'book', true, true, true),
    (v_admin_id, 'agents', true, true, true),
    (v_admin_id, 'configuration', true, true, true),
    (v_admin_id, 'monitoring', true, true, true),
    (v_admin_id, 'settings', true, true, true)
  ON CONFLICT (position_id, section) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit,
      can_delete = EXCLUDED.can_delete;
END $$;