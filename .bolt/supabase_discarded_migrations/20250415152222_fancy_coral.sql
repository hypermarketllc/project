/*
  # Fix Commission Calculation Function

  1. Changes
    - Fix PL/pgSQL syntax in calculate_commissions function
    - Properly declare variables and function blocks
    - Re-create trigger with fixed function
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS after_deal_insert ON deals;
DROP FUNCTION IF EXISTS calculate_commissions;

-- Create the fixed function
CREATE OR REPLACE FUNCTION calculate_commissions()
RETURNS TRIGGER AS $$
DECLARE
  agent_position_id UUID;
BEGIN
  -- Fetch the agent's position
  SELECT position_id INTO agent_position_id
  FROM users
  WHERE id = NEW.agent_id;

  -- Recursive CTE to find uplines
  WITH RECURSIVE upline_chain AS (
    SELECT id, upline_id, position_id
    FROM users
    WHERE id = NEW.agent_id

    UNION ALL

    SELECT u.id, u.upline_id, u.position_id
    FROM users u
    JOIN upline_chain uc ON u.id = uc.upline_id
  )

  -- Insert calculated commissions
  INSERT INTO commissions (deal_id, user_id, position_id, amount, percentage)
  SELECT 
    NEW.id,
    uc.id,
    uc.position_id,
    (NEW.annual_premium * cs.percentage / 100),
    cs.percentage
  FROM upline_chain uc
  JOIN commission_splits cs ON uc.position_id = cs.position_id
  WHERE cs.product_id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger
CREATE TRIGGER after_deal_insert
AFTER INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION calculate_commissions();