/*
  # Set up owner permissions
  
  1. Changes
    - Ensure owner position exists with highest level
    - Update admin@americancoveragecenter.com to have owner position
    - Grant full permissions to owner position
    - Add function to check if user is owner
*/

-- First ensure the owner position exists with highest level
INSERT INTO positions (name, level, description)
VALUES ('owner', 5, 'Organization owner with full system access')
ON CONFLICT (name) DO UPDATE
SET level = 5,
    description = 'Organization owner with full system access';

-- Update the owner account to have owner position
UPDATE users
SET position_id = (SELECT id FROM positions WHERE name = 'owner'),
    is_active = true
WHERE email = 'admin@americancoveragecenter.com';

-- Function to check if user is owner
CREATE OR REPLACE FUNCTION is_owner(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM users u
    JOIN positions p ON u.position_id = p.id
    WHERE u.id = user_id
    AND p.name = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's position level
CREATE OR REPLACE FUNCTION get_user_position_level(user_id uuid)
RETURNS integer AS $$
DECLARE
  position_level integer;
BEGIN
  -- Owner always returns highest level
  IF is_owner(user_id) THEN
    RETURN 5;
  END IF;

  SELECT p.level INTO position_level
  FROM users u
  JOIN positions p ON u.position_id = p.id
  WHERE u.id = user_id;
  
  RETURN COALESCE(position_level, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_viewable_agents function to handle owner
CREATE OR REPLACE FUNCTION get_viewable_agents(user_id uuid)
RETURNS TABLE (agent_id uuid) AS $$
BEGIN
  -- Owner can see all agents
  IF is_owner(user_id) THEN
    RETURN QUERY SELECT id FROM users WHERE is_active = true;
  END IF;

  -- Get the user's position level
  RETURN QUERY
  WITH RECURSIVE hierarchy AS (
    -- Base case: direct reports
    SELECT u.id
    FROM users u
    WHERE u.id = user_id
    
    UNION
    
    -- Recursive case: reports of reports (for managers and above)
    SELECT u.id
    FROM users u
    INNER JOIN hierarchy h ON u.upline_id = h.id
    WHERE get_user_position_level(user_id) >= 3
  )
  SELECT id FROM hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant all permissions to owner position
INSERT INTO position_permissions (
  position_id,
  section,
  can_view,
  can_edit,
  can_delete
)
SELECT 
  p.id as position_id,
  s.section_name,
  true as can_view,
  true as can_edit,
  true as can_delete
FROM positions p
CROSS JOIN (
  SELECT unnest(ARRAY[
    'dashboard',
    'post-deal',
    'agents',
    'book',
    'configuration',
    'monitoring',
    'settings'
  ]) as section_name
) s
WHERE p.name = 'owner'
ON CONFLICT (position_id, section) DO UPDATE
SET can_view = true,
    can_edit = true,
    can_delete = true;

-- Update the check_position_permission function to handle owner
CREATE OR REPLACE FUNCTION check_position_permission(
  p_position_id uuid,
  p_section text,
  p_action text DEFAULT 'view'
)
RETURNS boolean AS $$
BEGIN
  -- Owner position always has full access
  IF EXISTS (
    SELECT 1 FROM positions 
    WHERE id = p_position_id AND name = 'owner'
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