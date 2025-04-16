/*
  # Add Commission Calculation Trigger
  
  1. Changes
    - Create or replace the commission calculation function
    - Drop existing trigger if it exists
    - Create new trigger for automatic commission calculation
*/

-- Create or replace function to calculate commissions
CREATE OR REPLACE FUNCTION calculate_commissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert commission record for the agent
  INSERT INTO commissions (deal_id, user_id, position_id, amount, percentage)
  SELECT 
    NEW.id as deal_id,
    NEW.agent_id as user_id,
    u.position_id,
    NEW.annual_premium * (cs.percentage / 100) as amount,
    cs.percentage
  FROM users u
  JOIN commission_splits cs ON cs.position_id = u.position_id
  WHERE u.id = NEW.agent_id
  AND cs.product_id = NEW.product_id;

  -- Insert commission records for upline (override commissions)
  WITH RECURSIVE upline AS (
    -- Base case: direct upline
    SELECT 
      u.id,
      u.upline_id,
      u.position_id,
      1 as level
    FROM users u
    WHERE u.id = NEW.agent_id
    
    UNION ALL
    
    -- Recursive case: upline's upline
    SELECT 
      u.id,
      u.upline_id,
      u.position_id,
      ul.level + 1
    FROM users u
    JOIN upline ul ON u.id = ul.upline_id
    WHERE ul.level < (
      SELECT CAST(value::json->>'override_levels' AS INTEGER)
      FROM settings
      WHERE key = 'override_levels'
    )
  )
  INSERT INTO commissions (deal_id, user_id, position_id, amount, percentage)
  SELECT 
    NEW.id as deal_id,
    u.upline_id as user_id,
    p.position_id,
    NEW.annual_premium * (cs.percentage / 100) * (0.5 ^ u.level) as amount,
    cs.percentage * (0.5 ^ u.level) as percentage
  FROM upline u
  JOIN users p ON p.id = u.upline_id
  JOIN commission_splits cs ON cs.position_id = p.position_id
  WHERE u.upline_id IS NOT NULL
  AND cs.product_id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS after_deal_insert ON deals;

-- Create trigger
CREATE TRIGGER after_deal_insert
  AFTER INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commissions();

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION calculate_commissions() TO authenticated;

-- Add comment to the function
COMMENT ON FUNCTION calculate_commissions IS 'Automatically calculates commissions for deals based on position hierarchy';