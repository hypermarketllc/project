/*
  # Add Book Hierarchy Functions
  
  1. New Functions
    - get_viewable_agents: Returns list of agent IDs a user can view deals for
    - get_agent_hierarchy: Returns the complete hierarchy under a user
    - filter_deals_by_hierarchy: Filters deals based on user's position and hierarchy

  2. Changes
    - Add indexes for better performance
*/

-- Function to get all agents under a user (downline)
CREATE OR REPLACE FUNCTION get_agent_hierarchy(user_id uuid)
RETURNS TABLE (agent_id uuid) AS $$
WITH RECURSIVE hierarchy AS (
  -- Base case: the user themselves
  SELECT id, position_id
  FROM users
  WHERE id = user_id

  UNION

  -- Recursive case: all users who have the current users as their upline
  SELECT u.id, u.position_id
  FROM users u
  INNER JOIN hierarchy h ON u.upline_id = h.id
)
SELECT id AS agent_id FROM hierarchy;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to get all viewable agents based on position level
CREATE OR REPLACE FUNCTION get_viewable_agents(user_id uuid)
RETURNS TABLE (agent_id uuid) AS $$
DECLARE
  user_position_level int;
BEGIN
  -- Get the user's position level
  SELECT p.level INTO user_position_level
  FROM users u
  JOIN positions p ON u.position_id = p.id
  WHERE u.id = user_id;

  -- Return appropriate agents based on position level
  CASE
    -- Owner (level 5) and Admin (level 4) can see all agents
    WHEN user_position_level >= 4 THEN
      RETURN QUERY SELECT id FROM users WHERE is_active = true;
    
    -- Manager (level 3) can see their team and downline
    WHEN user_position_level = 3 THEN
      RETURN QUERY SELECT agent_id FROM get_agent_hierarchy(user_id);
    
    -- Senior Agent (level 2) can see their immediate downline
    WHEN user_position_level = 2 THEN
      RETURN QUERY 
      SELECT id FROM users WHERE upline_id = user_id
      UNION
      SELECT user_id;
    
    -- Agent (level 1) can only see their own deals
    ELSE
      RETURN QUERY SELECT user_id::uuid;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to filter deals based on user's hierarchy
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
BEGIN
  RETURN QUERY
  SELECT d.*
  FROM deals d
  WHERE d.agent_id IN (SELECT agent_id FROM get_viewable_agents(user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_upline_id ON users(upline_id);
CREATE INDEX IF NOT EXISTS idx_users_position_id ON users(position_id);
CREATE INDEX IF NOT EXISTS idx_deals_agent_id ON deals(agent_id);