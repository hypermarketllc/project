/*
  # Add Commission Logic
  
  This migration implements the commission logic as described in the commission-logic-guide.md document.
  
  Changes:
  1. Update Carrier table with payment type and advance period fields
  2. Ensure Position table has Agent and Owner positions
  3. Update Commission table with additional fields for tracking advance/future commissions
  4. Add functions for commission calculation and chargeback processing
*/

-- 1. Update Carrier table with payment type and advance period fields
ALTER TABLE carriers 
ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'advance' CHECK (payment_type IN ('advance', 'monthly')),
ADD COLUMN IF NOT EXISTS advance_period_months INTEGER NOT NULL DEFAULT 9;

-- 2. Ensure Position table has Agent and Owner positions
INSERT INTO positions (id, name, level, description)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Agent', 1, 'Agent who closes the deal')
ON CONFLICT (id) DO UPDATE 
SET name = 'Agent', level = 1, description = 'Agent who closes the deal';

INSERT INTO positions (id, name, level, description)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'Owner', 2, 'Agency owner')
ON CONFLICT (id) DO UPDATE 
SET name = 'Owner', level = 2, description = 'Agency owner';

-- 3. Update Commission table with additional fields
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'advance' CHECK (commission_type IN ('advance', 'future', 'monthly')),
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS is_chargeback BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS chargeback_date DATE,
ADD COLUMN IF NOT EXISTS original_commission_id UUID REFERENCES commissions(id);

-- 4. Create a function to calculate commissions for a deal
CREATE OR REPLACE FUNCTION calculate_commissions(p_deal_id UUID)
RETURNS VOID AS $$
DECLARE
  v_deal RECORD;
  v_carrier RECORD;
  v_agent_id UUID;
  v_owner_id UUID;
  v_agent_position_id UUID;
  v_owner_position_id UUID;
  v_agent_percentage NUMERIC;
  v_owner_percentage NUMERIC;
  v_advance_amount NUMERIC;
  v_future_amount NUMERIC;
  v_monthly_amount NUMERIC;
  v_advance_date DATE;
  v_future_date DATE;
  v_commission_id UUID;
BEGIN
  -- Get deal information
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;
  
  -- Get carrier information
  SELECT * INTO v_carrier FROM carriers WHERE id = v_deal.carrier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carrier not found: %', v_deal.carrier_id;
  END IF;
  
  -- Get agent and owner IDs
  v_agent_id := v_deal.agent_id;
  
  -- Find the owner (assuming the owner is the upline of the agent)
  SELECT upline_id INTO v_owner_id FROM agents WHERE id = v_agent_id;
  IF v_owner_id IS NULL THEN
    -- If no upline, find a user with Owner position
    SELECT a.id INTO v_owner_id 
    FROM agents a
    JOIN positions p ON a.position_id = p.id
    WHERE p.name = 'Owner'
    LIMIT 1;
  END IF;
  
  -- Get position IDs
  SELECT id INTO v_agent_position_id FROM positions WHERE name = 'Agent';
  SELECT id INTO v_owner_position_id FROM positions WHERE name = 'Owner';
  
  -- Get commission percentages
  -- First try to get from commission_splits table
  SELECT percentage INTO v_agent_percentage
  FROM commission_splits
  WHERE position_id = v_agent_position_id AND product_id = v_deal.product_id;
  
  -- If not found, use default 40%
  IF v_agent_percentage IS NULL THEN
    v_agent_percentage := 40;
  END IF;
  
  -- Owner gets the remainder
  v_owner_percentage := 100 - v_agent_percentage;
  
  -- Set dates
  v_advance_date := CURRENT_DATE;
  v_future_date := CURRENT_DATE + (v_carrier.advance_period_months * INTERVAL '1 month');
  
  -- Calculate commission amounts based on carrier payment type
  IF v_carrier.payment_type = 'advance' THEN
    -- Advance payment carrier
    v_advance_amount := v_deal.annual_premium * (v_carrier.advance_rate / 100);
    v_future_amount := v_deal.annual_premium - v_advance_amount;
    
    -- Create advance commission records
    -- Agent advance commission
    INSERT INTO commissions (
      deal_id, user_id, position_id, amount, percentage, status, 
      commission_type, payment_date, is_chargeback
    )
    VALUES (
      p_deal_id, v_agent_id, v_agent_position_id, 
      (v_advance_amount * (v_agent_percentage / 100)), 
      v_agent_percentage, 'pending', 'advance', v_advance_date, false
    )
    RETURNING id INTO v_commission_id;
    
    -- Owner advance commission
    INSERT INTO commissions (
      deal_id, user_id, position_id, amount, percentage, status, 
      commission_type, payment_date, is_chargeback
    )
    VALUES (
      p_deal_id, v_owner_id, v_owner_position_id, 
      (v_advance_amount * (v_owner_percentage / 100)), 
      v_owner_percentage, 'pending', 'advance', v_advance_date, false
    );
    
    -- Create future commission records (if there's any future amount)
    IF v_future_amount > 0 THEN
      -- Agent future commission
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage, status, 
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        p_deal_id, v_agent_id, v_agent_position_id, 
        (v_future_amount * (v_agent_percentage / 100)), 
        v_agent_percentage, 'pending', 'future', v_future_date, false
      );
      
      -- Owner future commission
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage, status, 
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        p_deal_id, v_owner_id, v_owner_position_id, 
        (v_future_amount * (v_owner_percentage / 100)), 
        v_owner_percentage, 'pending', 'future', v_future_date, false
      );
    END IF;
    
  ELSE
    -- Monthly payment carrier
    v_monthly_amount := v_deal.monthly_premium;
    
    -- Create 12 monthly commission records
    FOR i IN 1..12 LOOP
      -- Agent monthly commission
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage, status, 
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        p_deal_id, v_agent_id, v_agent_position_id, 
        (v_monthly_amount * (v_agent_percentage / 100)), 
        v_agent_percentage, 'pending', 'monthly', 
        CURRENT_DATE + ((i-1) * INTERVAL '1 month'), false
      );
      
      -- Owner monthly commission
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage, status, 
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        p_deal_id, v_owner_id, v_owner_position_id, 
        (v_monthly_amount * (v_owner_percentage / 100)), 
        v_owner_percentage, 'pending', 'monthly', 
        CURRENT_DATE + ((i-1) * INTERVAL '1 month'), false
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Create a function to process chargebacks
CREATE OR REPLACE FUNCTION process_chargeback(p_deal_id UUID)
RETURNS VOID AS $$
DECLARE
  v_deal RECORD;
  v_carrier RECORD;
  v_advance_end_date DATE;
  v_commission RECORD;
BEGIN
  -- Get deal information
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;
  
  -- Get carrier information
  SELECT * INTO v_carrier FROM carriers WHERE id = v_deal.carrier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carrier not found: %', v_deal.carrier_id;
  END IF;
  
  -- Only process chargebacks for advance payment carriers
  IF v_carrier.payment_type = 'advance' THEN
    -- Calculate the end date of the advance period
    v_advance_end_date := v_deal.created_at::DATE + (v_carrier.advance_period_months * INTERVAL '1 month');
    
    -- Check if the policy lapsed during the advance period
    IF CURRENT_DATE <= v_advance_end_date THEN
      -- Policy lapsed during advance period, create chargeback records
      
      -- For each advance commission, create a chargeback record
      FOR v_commission IN 
        SELECT * FROM commissions 
        WHERE deal_id = p_deal_id 
        AND commission_type = 'advance' 
        AND is_chargeback = false
      LOOP
        -- Create chargeback record
        INSERT INTO commissions (
          deal_id, user_id, position_id, amount, percentage, status, 
          commission_type, payment_date, is_chargeback, chargeback_date, original_commission_id
        )
        VALUES (
          p_deal_id, v_commission.user_id, v_commission.position_id, 
          -v_commission.amount, v_commission.percentage, 'pending', 
          'advance', CURRENT_DATE, true, CURRENT_DATE, v_commission.id
        );
      END LOOP;
      
      -- Cancel all future commissions
      UPDATE commissions
      SET status = 'cancelled'
      WHERE deal_id = p_deal_id
      AND commission_type = 'future'
      AND payment_date > CURRENT_DATE;
    ELSE
      -- Policy lapsed after advance period, just cancel future commissions
      UPDATE commissions
      SET status = 'cancelled'
      WHERE deal_id = p_deal_id
      AND commission_type IN ('future', 'monthly')
      AND payment_date > CURRENT_DATE;
    END IF;
  ELSE
    -- For monthly carriers, just cancel future commissions
    UPDATE commissions
    SET status = 'cancelled'
    WHERE deal_id = p_deal_id
    AND commission_type = 'monthly'
    AND payment_date > CURRENT_DATE;
  END IF;
  
  -- Update deal status to lapsed
  UPDATE deals
  SET status = 'lapsed',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_deal_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a function to reinstate a policy
CREATE OR REPLACE FUNCTION reinstate_policy(p_deal_id UUID)
RETURNS VOID AS $$
DECLARE
  v_deal RECORD;
BEGIN
  -- Get deal information
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;
  
  -- Update deal status to active
  UPDATE deals
  SET status = 'active',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_deal_id;
  
  -- Reactivate future commissions that were cancelled
  UPDATE commissions
  SET status = 'pending'
  WHERE deal_id = p_deal_id
  AND status = 'cancelled'
  AND payment_date > CURRENT_DATE;
  
  -- Note: We don't reverse chargebacks that have already been processed
END;
$$ LANGUAGE plpgsql;

-- 7. Create a trigger to calculate commissions when a deal is created
CREATE OR REPLACE FUNCTION trigger_calculate_commissions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_commissions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deal_commission_trigger ON deals;
CREATE TRIGGER deal_commission_trigger
AFTER INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION trigger_calculate_commissions();

-- 8. Create a trigger to process chargebacks when a deal status changes to lapsed
CREATE OR REPLACE FUNCTION trigger_process_chargeback()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'lapsed' AND OLD.status != 'lapsed' THEN
    PERFORM process_chargeback(NEW.id);
  ELSIF NEW.status = 'active' AND OLD.status = 'lapsed' THEN
    PERFORM reinstate_policy(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deal_status_trigger ON deals;
CREATE TRIGGER deal_status_trigger
AFTER UPDATE OF status ON deals
FOR EACH ROW
EXECUTE FUNCTION trigger_process_chargeback();

-- 9. Create views for dashboard metrics
CREATE OR REPLACE VIEW money_in_production AS
SELECT 
  SUM(CASE WHEN c.commission_type = 'advance' AND c.is_chargeback = false THEN c.amount ELSE 0 END) AS total_advance,
  SUM(CASE WHEN c.commission_type = 'monthly' AND c.is_chargeback = false AND c.payment_date <= CURRENT_DATE THEN c.amount ELSE 0 END) AS total_monthly,
  SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS total_chargebacks,
  SUM(CASE 
    WHEN (c.commission_type IN ('advance', 'monthly') AND c.is_chargeback = false AND c.payment_date <= CURRENT_DATE)
    OR c.is_chargeback = true
    THEN c.amount 
    ELSE 0 
  END) AS net_production
FROM commissions c;

CREATE OR REPLACE VIEW total_commission AS
SELECT 
  c.user_id,
  u.full_name AS agent_name,
  p.name AS position,
  SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) AS paid_commission,
  SUM(CASE WHEN c.status = 'pending' AND c.payment_date <= CURRENT_DATE THEN c.amount ELSE 0 END) AS pending_commission,
  SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS chargebacks,
  SUM(CASE 
    WHEN (c.status = 'paid' OR (c.status = 'pending' AND c.payment_date <= CURRENT_DATE))
    THEN c.amount 
    ELSE 0 
  END) + SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS net_commission
FROM commissions c
JOIN agents u ON c.user_id = u.id
JOIN positions p ON c.position_id = p.id
GROUP BY c.user_id, u.full_name, p.name;

CREATE OR REPLACE VIEW future_commission AS
SELECT 
  c.user_id,
  u.full_name AS agent_name,
  p.name AS position,
  SUM(CASE WHEN c.status = 'pending' AND c.payment_date > CURRENT_DATE THEN c.amount ELSE 0 END) AS future_commission
FROM commissions c
JOIN agents u ON c.user_id = u.id
JOIN positions p ON c.position_id = p.id
WHERE c.status = 'pending' AND c.payment_date > CURRENT_DATE
GROUP BY c.user_id, u.full_name, p.name;

-- Add comments to explain the functions
COMMENT ON FUNCTION calculate_commissions IS 'Calculates commissions for a deal based on carrier payment type, advance rate, and commission percentages';
COMMENT ON FUNCTION process_chargeback IS 'Processes chargebacks when a policy lapses, creating chargeback records and cancelling future commissions';
COMMENT ON FUNCTION reinstate_policy IS 'Reinstates a policy, reactivating future commissions';
COMMENT ON FUNCTION trigger_calculate_commissions IS 'Trigger function to calculate commissions when a deal is created';
COMMENT ON FUNCTION trigger_process_chargeback IS 'Trigger function to process chargebacks when a deal status changes to lapsed';