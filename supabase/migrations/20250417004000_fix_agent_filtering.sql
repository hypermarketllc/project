/*
  # Fix Agent Position Filtering
  
  1. Changes
    - Update the filter_deals_by_hierarchy function to focus on positions rather than specific accounts
    - Ensure all accounts with agent position (level 1) only see their own deals
    - Maintain special case for admin@example.com for testing purposes
*/

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
  user_position_name text;
  user_email text;
  debug_info text;
BEGIN
  -- Get user's email, position level and name
  SELECT u.email, p.level, p.name INTO user_email, user_position_level, user_position_name
  FROM users u
  LEFT JOIN positions p ON u.position_id = p.id
  WHERE u.id = user_id;
  
  -- Special case for admin@example.com account (for testing purposes)
  IF user_email = 'admin@example.com' THEN
    -- For admin@example.com, return all deals
    RETURN QUERY
    SELECT d.*
    FROM deals d;
    RETURN;
  END IF;
  
  -- Special case for test-agent-id (for testing purposes)
  IF user_id::text = 'test-agent-id' THEN
    -- For test agent, return only their own deals
    RETURN QUERY
    SELECT d.*
    FROM deals d
    WHERE d.agent_id = user_id;
    RETURN;
  END IF;
  
  -- Create debug info
  debug_info := 'User ID: ' || user_id || ', Email: ' || user_email || ', Position: ' || user_position_name || ', Level: ' || user_position_level;
  
  -- Log debug info
  RAISE NOTICE '%', debug_info;
  
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
    WHEN user_position_level = 1 THEN d.agent_id = user_id
    -- Default case: only see own deals (for safety)
    ELSE d.agent_id = user_id
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain function usage
COMMENT ON FUNCTION filter_deals_by_hierarchy IS 'Filters deals based on user position level and hierarchy. Admins and owners see all deals, managers see their team deals, senior agents see their own and downline deals, and regular agents only see their own deals. Position-based filtering ensures consistent behavior across all accounts with the same position.';