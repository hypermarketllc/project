-- Simple Commission Fix
-- Run this in the Supabase SQL Editor

-- 1. Delete existing commissions
DELETE FROM commissions;

-- 2. Check if any deals exist
DO $$
DECLARE
  v_deal_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_deal_count FROM deals;
  RAISE NOTICE 'Found % deals.', v_deal_count;
  
  IF v_deal_count = 0 THEN
    RAISE NOTICE 'No deals found. Please create some deals first.';
  END IF;
END $$;

-- 3. Recalculate commissions for all deals
DO $$
DECLARE
  v_deal RECORD;
BEGIN
  FOR v_deal IN
    SELECT * FROM deals
  LOOP
    -- Calculate advance amount (75% of annual premium)
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
      
      RAISE NOTICE 'Calculated commissions for deal %', v_deal.id;
    END;
  END LOOP;
END $$;

-- 4. Verify the results
SELECT 
  SUM(CASE WHEN commission_type = 'advance' AND user_id IN (SELECT id FROM users WHERE position_id = (SELECT id FROM positions WHERE name = 'Agent')) THEN amount ELSE 0 END) AS agent_advance_commission,
  SUM(CASE WHEN commission_type = 'future' AND user_id IN (SELECT id FROM users WHERE position_id = (SELECT id FROM positions WHERE name = 'Agent')) THEN amount ELSE 0 END) AS agent_future_commission,
  SUM(CASE WHEN commission_type = 'advance' AND user_id IN (SELECT id FROM users WHERE position_id = (SELECT id FROM positions WHERE name = 'Owner')) THEN amount ELSE 0 END) AS owner_advance_commission,
  SUM(CASE WHEN commission_type = 'future' AND user_id IN (SELECT id FROM users WHERE position_id = (SELECT id FROM positions WHERE name = 'Owner')) THEN amount ELSE 0 END) AS owner_future_commission
FROM commissions;

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