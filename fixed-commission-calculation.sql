-- Fixed Commission Calculation
-- This script fixes the commission calculations with the correct advance rate

-- 0. Print the total premium and expected advance amount
SELECT 
  SUM(annual_premium) AS total_premium,
  SUM(annual_premium) * 0.75 AS expected_advance_75_percent
FROM deals;

-- 1. Delete existing commissions
DELETE FROM commissions;

-- 2. Recalculate commissions for all deals with explicit 75% advance rate
DO $$
DECLARE
  v_deal RECORD;
  v_total_premium NUMERIC := 0;
  v_total_advance NUMERIC := 0;
  v_total_future NUMERIC := 0;
BEGIN
  -- Calculate totals first
  SELECT SUM(annual_premium) INTO v_total_premium FROM deals;
  RAISE NOTICE 'Total Premium: %', v_total_premium;
  RAISE NOTICE 'Expected Advance (75%%): %', v_total_premium * 0.75;
  RAISE NOTICE 'Expected Future (25%%): %', v_total_premium * 0.25;
  
  -- Loop through all deals
  FOR v_deal IN
    SELECT * FROM deals
  LOOP
    -- Calculate advance amount (exactly 75% of annual premium)
    DECLARE
      v_advance_amount NUMERIC := v_deal.annual_premium * 0.75;
      v_future_amount NUMERIC := v_deal.annual_premium * 0.25;
      v_agent_id UUID := v_deal.agent_id;
      v_owner_id UUID;
      v_agent_position_id UUID;
      v_owner_position_id UUID;
    BEGIN
      -- Get position IDs
      SELECT id INTO v_agent_position_id FROM positions WHERE name = 'Agent';
      SELECT id INTO v_owner_position_id FROM positions WHERE name = 'Owner';
      
      -- Get owner ID (first user with Owner position)
      SELECT u.id INTO v_owner_id
      FROM users u
      JOIN positions p ON u.position_id = p.id
      WHERE p.name = 'Owner'
      LIMIT 1;
      
      -- If no owner found, use agent as owner
      IF v_owner_id IS NULL THEN
        v_owner_id := v_agent_id;
      END IF;
      
      -- Insert advance commission for agent (40%)
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage,
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        v_deal.id, v_agent_id, v_agent_position_id,
        v_advance_amount * 0.4, 40, 'advance', CURRENT_DATE, false
      );
      
      -- Insert advance commission for owner (60%)
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage,
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        v_deal.id, v_owner_id, v_owner_position_id,
        v_advance_amount * 0.6, 60, 'advance', CURRENT_DATE, false
      );
      
      -- Insert future commission for agent (40%)
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage,
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        v_deal.id, v_agent_id, v_agent_position_id,
        v_future_amount * 0.4, 40, 'future', CURRENT_DATE + INTERVAL '9 months', false
      );
      
      -- Insert future commission for owner (60%)
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage,
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        v_deal.id, v_owner_id, v_owner_position_id,
        v_future_amount * 0.6, 60, 'future', CURRENT_DATE + INTERVAL '9 months', false
      );
      
      RAISE NOTICE 'Deal %: Annual Premium = %, Advance = %, Future = %',
        v_deal.id, v_deal.annual_premium, v_advance_amount, v_future_amount;
      
      -- Add to running totals
      v_total_advance := v_total_advance + v_advance_amount;
      v_total_future := v_total_future + v_future_amount;
    END;
  END LOOP;
  
  RAISE NOTICE 'Total Advance Amount: %', v_total_advance;
  RAISE NOTICE 'Total Future Amount: %', v_total_future;
  RAISE NOTICE 'Total Commission Amount: %', v_total_advance + v_total_future;
END $$;

-- 3. Verify the results
SELECT 
  SUM(CASE WHEN commission_type = 'advance' THEN amount ELSE 0 END) AS total_advance,
  SUM(CASE WHEN commission_type = 'future' THEN amount ELSE 0 END) AS total_future,
  SUM(amount) AS total_commission
FROM commissions;

-- 4. Verify the results by position
SELECT 
  p.name AS position_name,
  SUM(CASE WHEN c.commission_type = 'advance' THEN c.amount ELSE 0 END) AS total_advance,
  SUM(CASE WHEN c.commission_type = 'future' THEN c.amount ELSE 0 END) AS total_future,
  SUM(c.amount) AS total_commission
FROM commissions c
JOIN positions p ON c.position_id = p.id
GROUP BY p.name;

-- 5. Update the views
DROP VIEW IF EXISTS money_in_production;
DROP VIEW IF EXISTS total_commission;
DROP VIEW IF EXISTS future_commission;

-- Create money_in_production view with user_id filtering
CREATE OR REPLACE VIEW money_in_production AS
SELECT 
  c.user_id,
  SUM(CASE
    WHEN (c.commission_type = 'advance' OR c.commission_type IS NULL) AND COALESCE(c.is_chargeback, false) = false
    THEN c.amount ELSE 0
  END) AS total_advance,
  
  SUM(CASE
    WHEN c.commission_type = 'monthly' AND COALESCE(c.is_chargeback, false) = false
    AND (c.payment_date <= CURRENT_DATE OR c.payment_date IS NULL)
    THEN c.amount ELSE 0
  END) AS total_monthly,
  
  SUM(CASE
    WHEN COALESCE(c.is_chargeback, true) = true
    THEN c.amount ELSE 0
  END) AS total_chargebacks,
  
  SUM(CASE
    WHEN (
      (c.commission_type IN ('advance', 'monthly') OR c.commission_type IS NULL)
      AND COALESCE(c.is_chargeback, false) = false
      AND (c.payment_date <= CURRENT_DATE OR c.payment_date IS NULL)
    ) OR COALESCE(c.is_chargeback, true) = true
    THEN c.amount
    ELSE 0
  END) AS net_production
FROM commissions c
GROUP BY c.user_id;

-- Create total_commission view with proper position filtering
CREATE OR REPLACE VIEW total_commission AS
SELECT
  c.user_id,
  COALESCE(u.full_name, 'Unknown User') AS agent_name,
  COALESCE(p.name, 'Unknown Position') AS "position",
  SUM(CASE
    WHEN (c.payment_date <= CURRENT_DATE OR c.payment_date IS NULL)
    AND COALESCE(c.is_chargeback, false) = false
    THEN c.amount ELSE 0
  END) AS paid_commission,
  
  SUM(CASE
    WHEN (c.payment_date <= CURRENT_DATE OR c.payment_date IS NULL)
    AND COALESCE(c.is_chargeback, false) = false
    THEN c.amount ELSE 0
  END) AS pending_commission,
  
  SUM(CASE
    WHEN COALESCE(c.is_chargeback, true) = true
    THEN c.amount ELSE 0
  END) AS chargebacks,
  
  SUM(CASE
    WHEN (c.payment_date <= CURRENT_DATE OR c.payment_date IS NULL)
    OR COALESCE(c.is_chargeback, true) = true
    THEN c.amount
    ELSE 0
  END) AS net_commission
FROM commissions c
LEFT JOIN users u ON c.user_id = u.id
LEFT JOIN positions p ON c.position_id = p.id
GROUP BY c.user_id, u.full_name, p.name;

-- Create future_commission view with proper position filtering
CREATE OR REPLACE VIEW future_commission AS
SELECT
  c.user_id,
  COALESCE(u.full_name, 'Unknown User') AS agent_name,
  COALESCE(p.name, 'Unknown Position') AS "position",
  SUM(CASE
    WHEN c.payment_date > CURRENT_DATE
    AND COALESCE(c.is_chargeback, false) = false
    THEN c.amount ELSE 0
  END) AS future_commission
FROM commissions c
LEFT JOIN users u ON c.user_id = u.id
LEFT JOIN positions p ON c.position_id = p.id
WHERE c.payment_date > CURRENT_DATE AND COALESCE(c.is_chargeback, false) = false
GROUP BY c.user_id, u.full_name, p.name;

-- 6. Verify the views
SELECT * FROM money_in_production;
SELECT * FROM total_commission;
SELECT * FROM future_commission;