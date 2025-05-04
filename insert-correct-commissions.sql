-- Insert Correct Commissions
-- This script directly inserts the correct commission values based on the actual deals

-- 1. Delete existing commissions
DELETE FROM commissions;

-- 2. Get deal information and insert correct commissions
DO $$
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
  v_advance_date DATE;
  v_future_date DATE;
  v_advance_rate NUMERIC;
  v_advance_period_months INTEGER;
  v_total_premium NUMERIC := 0;
  v_total_advance NUMERIC := 0;
  v_total_future NUMERIC := 0;
BEGIN
  -- Get position IDs
  SELECT id INTO v_agent_position_id FROM positions WHERE name = 'Agent';
  SELECT id INTO v_owner_position_id FROM positions WHERE name = 'Owner';
  
  -- Set default values if positions not found
  IF v_agent_position_id IS NULL THEN
    RAISE NOTICE 'Agent position not found. Using default position ID.';
    v_agent_position_id := '00000000-0000-0000-0000-000000000001';
  END IF;
  
  IF v_owner_position_id IS NULL THEN
    RAISE NOTICE 'Owner position not found. Using default position ID.';
    v_owner_position_id := '00000000-0000-0000-0000-000000000002';
  END IF;
  
  -- Set default percentages
  v_agent_percentage := 40;
  v_owner_percentage := 60;
  
  -- Set default advance rate and period
  v_advance_rate := 75;
  v_advance_period_months := 9;
  
  -- Set dates
  v_advance_date := CURRENT_DATE;
  v_future_date := CURRENT_DATE + (v_advance_period_months * INTERVAL '1 month');
  
  -- Loop through all deals
  FOR v_deal IN
    SELECT * FROM deals
  LOOP
    -- Get agent ID
    v_agent_id := v_deal.agent_id;
    
    -- Find owner ID (first user with Owner position)
    SELECT u.id INTO v_owner_id
    FROM users u
    JOIN positions p ON u.position_id = p.id
    WHERE p.name = 'Owner'
    LIMIT 1;
    
    -- If no owner found, use the first user as owner
    IF v_owner_id IS NULL THEN
      SELECT id INTO v_owner_id FROM users LIMIT 1;
    END IF;
    
    -- If still no owner, use agent as owner
    IF v_owner_id IS NULL THEN
      v_owner_id := v_agent_id;
    END IF;
    
    -- Get carrier information if available
    BEGIN
      SELECT * INTO v_carrier FROM carriers WHERE id = v_deal.carrier_id;
      
      -- Use carrier's advance rate and period if available
      IF v_carrier.advance_rate IS NOT NULL THEN
        v_advance_rate := v_carrier.advance_rate;
      END IF;
      
      IF v_carrier.advance_period_months IS NOT NULL THEN
        v_advance_period_months := v_carrier.advance_period_months;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Carrier not found for deal %. Using default values.', v_deal.id;
    END;
    
    -- Calculate advance and future amounts
    v_advance_amount := v_deal.annual_premium * (v_advance_rate / 100);
    v_future_amount := v_deal.annual_premium - v_advance_amount;
    
    -- Add to totals
    v_total_premium := v_total_premium + v_deal.annual_premium;
    v_total_advance := v_total_advance + v_advance_amount;
    v_total_future := v_total_future + v_future_amount;
    
    RAISE NOTICE 'Deal %: Annual Premium = %, Advance Rate = %, Advance Amount = %, Future Amount = %',
      v_deal.id, v_deal.annual_premium, v_advance_rate, v_advance_amount, v_future_amount;
    
    -- Insert advance commission for agent
    INSERT INTO commissions (
      deal_id, user_id, position_id, amount, percentage,
      commission_type, payment_date, is_chargeback
    )
    VALUES (
      v_deal.id, v_agent_id, v_agent_position_id,
      (v_advance_amount * (v_agent_percentage / 100)),
      v_agent_percentage, 'advance', v_advance_date, false
    );
    
    -- Insert advance commission for owner
    INSERT INTO commissions (
      deal_id, user_id, position_id, amount, percentage,
      commission_type, payment_date, is_chargeback
    )
    VALUES (
      v_deal.id, v_owner_id, v_owner_position_id,
      (v_advance_amount * (v_owner_percentage / 100)),
      v_owner_percentage, 'advance', v_advance_date, false
    );
    
    -- Insert future commission for agent
    INSERT INTO commissions (
      deal_id, user_id, position_id, amount, percentage,
      commission_type, payment_date, is_chargeback
    )
    VALUES (
      v_deal.id, v_agent_id, v_agent_position_id,
      (v_future_amount * (v_agent_percentage / 100)),
      v_agent_percentage, 'future', v_future_date, false
    );
    
    -- Insert future commission for owner
    INSERT INTO commissions (
      deal_id, user_id, position_id, amount, percentage,
      commission_type, payment_date, is_chargeback
    )
    VALUES (
      v_deal.id, v_owner_id, v_owner_position_id,
      (v_future_amount * (v_owner_percentage / 100)),
      v_owner_percentage, 'future', v_future_date, false
    );
  END LOOP;
  
  RAISE NOTICE 'Total Premium: %', v_total_premium;
  RAISE NOTICE 'Total Advance: %', v_total_advance;
  RAISE NOTICE 'Total Future: %', v_total_future;
  RAISE NOTICE 'Agent Advance Commission (40%%): %', v_total_advance * (v_agent_percentage / 100);
  RAISE NOTICE 'Agent Future Commission (40%%): %', v_total_future * (v_agent_percentage / 100);
END $$;

-- 3. Update the views
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

-- Print success message
DO $$
BEGIN
  RAISE NOTICE 'Correct commissions inserted!';
  RAISE NOTICE 'Please refresh your dashboard to see the updated commission data.';
END $$;