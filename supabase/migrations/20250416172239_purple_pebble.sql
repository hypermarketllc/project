/*
  # Update Senior Agent Permissions
  
  1. Changes
    - Grant access to dashboard, post-deal, and book sections
    - Remove access to agents section
    - Update permission checks for senior agents
*/

-- Update permissions for senior agents
INSERT INTO position_permissions (position_id, section, can_view, can_edit, can_delete)
SELECT 
  p.id as position_id,
  s.section_name as section,
  true as can_view,
  true as can_edit,
  CASE 
    WHEN s.section_name = 'agents' THEN false
    ELSE true
  END as can_delete
FROM positions p
CROSS JOIN (
  SELECT unnest(ARRAY[
    'dashboard',
    'post-deal',
    'book'
  ]) as section_name
) s
WHERE p.name = 'senior_agent'
ON CONFLICT (position_id, section) 
DO UPDATE SET 
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;

-- Remove agents section access for senior agents
DELETE FROM position_permissions
WHERE position_id IN (SELECT id FROM positions WHERE name = 'senior_agent')
AND section = 'agents';

-- Update the filter_deals_by_hierarchy function
CREATE OR REPLACE FUNCTION filter_deals_by_hierarchy(user_id uuid)
RETURNS TABLE (
  id uuid,
  agent_id uuid,
  carrier_id uuid,
  product_id uuid,
  client_name text,
  annual_premium numeric,
  created_at timestamptz,
  app_number text,
  client_phone text,
  effective_date date,
  from_referral boolean,
  status text,
  policy_number text,
  submitted_at timestamptz
) AS $$
DECLARE
  user_position_level int;
BEGIN
  -- Get user's position level
  SELECT p.level INTO user_position_level
  FROM users u
  JOIN positions p ON u.position_id = p.id
  WHERE u.id = user_id;

  -- Return deals based on position level
  RETURN QUERY
  SELECT d.*
  FROM deals d
  WHERE CASE
    -- Admins and owners see all deals
    WHEN user_position_level >= 4 THEN true
    -- Managers see their team's deals
    WHEN user_position_level = 3 THEN d.agent_id IN (
      SELECT agent_id FROM get_agent_hierarchy(user_id)
    )
    -- Senior agents see their own and downline's deals
    WHEN user_position_level = 2 THEN d.agent_id IN (
      SELECT id FROM users WHERE upline_id = user_id
      UNION SELECT user_id
    )
    -- Regular agents only see their own deals
    ELSE d.agent_id = user_id
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;