-- This is a manual SQL script to fix the agent filtering issues
-- You can run this directly in the Supabase SQL editor

-- 1. First, check if the agent position exists
DO $$
DECLARE
  agent_position_id uuid;
  updated_count int;
BEGIN
  -- Check if agent position exists
  SELECT id INTO agent_position_id FROM positions WHERE name = 'Agent' OR name = 'agent';
  
  -- If agent position doesn't exist, create it
  IF agent_position_id IS NULL THEN
    INSERT INTO positions (name, level, description)
    VALUES ('Agent', 1, 'Regular agent position')
    RETURNING id INTO agent_position_id;
    
    RAISE NOTICE 'Created new agent position with ID: %', agent_position_id;
  ELSE
    RAISE NOTICE 'Found existing agent position with ID: %', agent_position_id;
  END IF;
  
  -- 2. Update existing users without a position to have the agent position
  WITH updated_users AS (
    UPDATE users
    SET position_id = agent_position_id
    WHERE position_id IS NULL
    RETURNING id
  )
  SELECT count(*) INTO updated_count FROM updated_users;
  
  RAISE NOTICE 'Updated % users to have the agent position', updated_count;
END $$;

-- 3. Update the filter_deals_by_hierarchy function to handle NULL position levels
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
  -- Special case for test agent account
  IF user_id::text = 'test-agent-id' THEN
    -- For test agent, return only their own deals
    RETURN QUERY
    SELECT d.*
    FROM deals d
    WHERE d.agent_id = user_id;
    RETURN;
  END IF;

  -- Get user's email, position level and name
  SELECT u.email, COALESCE(p.level, 1), COALESCE(p.name, 'Agent') 
  INTO user_email, user_position_level, user_position_name
  FROM users u
  LEFT JOIN positions p ON u.position_id = p.id
  WHERE u.id = user_id;
  
  -- Special case for admin@example.com account
  IF user_email = 'admin@example.com' THEN
    -- For admin@example.com, return all deals
    RETURN QUERY
    SELECT d.*
    FROM deals d;
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
    -- Regular agents (level 1) or NULL position only see their own deals
    ELSE d.agent_id = user_id
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a trigger to set the default position for new users
CREATE OR REPLACE FUNCTION set_default_position()
RETURNS TRIGGER AS $$
DECLARE
  agent_position_id uuid;
BEGIN
  -- Get agent position ID
  SELECT id INTO agent_position_id FROM positions WHERE name = 'Agent' OR name = 'agent';
  
  -- If agent position doesn't exist, create it
  IF agent_position_id IS NULL THEN
    INSERT INTO positions (name, level, description)
    VALUES ('Agent', 1, 'Regular agent position')
    RETURNING id INTO agent_position_id;
  END IF;
  
  -- Set position_id to agent position if it's NULL
  IF NEW.position_id IS NULL THEN
    NEW.position_id := agent_position_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS set_default_position_trigger ON users;

-- Create the trigger
CREATE TRIGGER set_default_position_trigger
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION set_default_position();

-- 5. Verify the changes
SELECT 'Verification of positions' as check_type, count(*) as count FROM positions WHERE name = 'Agent' OR name = 'agent';
SELECT 'Users without position' as check_type, count(*) as count FROM users WHERE position_id IS NULL;