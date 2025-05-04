-- Carrier-Based Commission Calculation
-- This script calculates commissions based on carrier.advance_rate

-- 0. Print the total premium and expected advance amount
SELECT 
  SUM(d.annual_premium) AS total_premium,
  SUM(d.annual_premium * (c.advance_rate / 100)) AS expected_advance_amount
FROM deals d
JOIN carriers c ON d.carrier_id = c.id;

-- 1. Delete existing commissions
DELETE FROM commissions;

-- 2. Recalculate commissions for all deals using carrier.advance_rate
DO $$
DECLARE
  v_deal RECORD;
  v_carrier RECORD;
  v_total_premium NUMERIC := 0;
  v_total_advance NUMERIC := 0;
  v_total_future NUMERIC := 0;
BEGIN
  -- Loop through all deals
  FOR v_deal IN
    SELECT d.*, c.advance_rate, c.advance_period_months, c.payment_type
    FROM deals d
    JOIN carriers c ON d.carrier_id = c.id
  LOOP
    -- Calculate advance amount based on carrier.advance_rate
    DECLARE
      v_advance_rate NUMERIC := v_deal.advance_rate;
      v_advance_period_months INTEGER := v_deal.advance_period_months;
      v_advance_amount NUMERIC;
      v_future_amount NUMERIC;
      v_agent_id UUID := v_deal.agent_id;
      v_owner_id UUID;
      v_agent_position_id UUID;
      v_owner_position_id UUID;
      v_agent_percentage NUMERIC := 40; -- Default agent percentage
      v_owner_percentage NUMERIC := 60; -- Default owner percentage
    BEGIN
      -- Set default values if needed
      IF v_advance_rate IS NULL THEN
        v_advance_rate := 75;
        RAISE NOTICE 'Using default advance rate of 75%% for deal %', v_deal.id;
      END IF;
      
      IF v_advance_period_months IS NULL THEN
        v_advance_period_months := 9;
        RAISE NOTICE 'Using default advance period of 9 months for deal %', v_deal.id;
      END IF;
      
      -- Calculate advance and future amounts
      v_advance_amount := v_deal.annual_premium * (v_advance_rate / 100);
      v_future_amount := v_deal.annual_premium - v_advance_amount;
      
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
      
      -- Check if there's a custom commission split for this product
      BEGIN
        SELECT percentage INTO v_agent_percentage
        FROM commission_splits
        WHERE position_id = v_agent_position_id AND product_id = v_deal.product_id;
        
        IF v_agent_percentage IS NOT NULL THEN
          v_owner_percentage := 100 - v_agent_percentage;
          RAISE NOTICE 'Using custom commission split for deal %: Agent %%, Owner %%', 
            v_deal.id, v_agent_percentage, v_owner_percentage;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Using default commission split for deal %: Agent 40%%, Owner 60%%', v_deal.id;
      END;
      
      -- Insert advance commission for agent
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage,
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        v_deal.id, v_agent_id, v_agent_position_id,
        v_advance_amount * (v_agent_percentage / 100),
        v_agent_percentage, 'advance', CURRENT_DATE, false
      );
      
      -- Insert advance commission for owner
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage,
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        v_deal.id, v_owner_id, v_owner_position_id,
        v_advance_amount * (v_owner_percentage / 100),
        v_owner_percentage, 'advance', CURRENT_DATE, false
      );
      
      -- Insert future commission for agent
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage,
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        v_deal.id, v_agent_id, v_agent_position_id,
        v_future_amount * (v_agent_percentage / 100),
        v_agent_percentage, 'future', CURRENT_DATE + (v_advance_period_months * INTERVAL '1 month'), false
      );
      
      -- Insert future commission for owner
      INSERT INTO commissions (
        deal_id, user_id, position_id, amount, percentage,
        commission_type, payment_date, is_chargeback
      )
      VALUES (
        v_deal.id, v_owner_id, v_owner_position_id,
        v_future_amount * (v_owner_percentage / 100),
        v_owner_percentage, 'future', CURRENT_DATE + (v_advance_period_months * INTERVAL '1 month'), false
      );
      
      RAISE NOTICE 'Deal %: Annual Premium = %, Advance Rate = %%, Advance = %, Future = %',
        v_deal.id, v_deal.annual_premium, v_advance_rate, v_advance_amount, v_future_amount;
      
      -- Add to running totals
      v_total_premium := v_total_premium + v_deal.annual_premium;
      v_total_advance := v_total_advance + v_advance_amount;
      v_total_future := v_total_future + v_future_amount;
    END;
  END LOOP;
  
  RAISE NOTICE 'Total Premium: %', v_total_premium;
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