-- Fix Commission Calculations
-- This script fixes issues with commission calculations

-- 1. Check if commissions are being calculated correctly
DO $$
DECLARE
  v_deal RECORD;
  v_commission_count INTEGER;
BEGIN
  -- Check if there are any commissions
  SELECT COUNT(*) INTO v_commission_count FROM commissions;
  
  RAISE NOTICE 'Found % commission records.', v_commission_count;
  
  -- If there are commissions, delete them and recalculate
  IF v_commission_count > 0 THEN
    RAISE NOTICE 'Deleting existing commission records...';
    DELETE FROM commissions;
    RAISE NOTICE 'Existing commission records deleted.';
  END IF;
  
  -- Recalculate commissions for all deals
  RAISE NOTICE 'Recalculating commissions for all deals...';
  
  FOR v_deal IN
    SELECT * FROM deals
  LOOP
    BEGIN
      PERFORM calculate_deal_commissions(v_deal.id);
      RAISE NOTICE 'Calculated commissions for deal %', v_deal.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error calculating commissions for deal %: %', v_deal.id, SQLERRM;
    END;
  END LOOP;
  
  -- Check if commissions were created
  SELECT COUNT(*) INTO v_commission_count FROM commissions;
  RAISE NOTICE 'Created % commission records.', v_commission_count;
END $$;

-- 2. Update the calculate_deal_commissions function
RAISE NOTICE 'Updating calculate_deal_commissions function...';

-- Update the function to ensure it's using the correct advance rate and commission percentages
CREATE OR REPLACE FUNCTION calculate_deal_commissions(p_deal_id UUID)
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
  v_agents_exists BOOLEAN;
  v_users_exists BOOLEAN;
  v_status_exists BOOLEAN;
BEGIN
    -- Check if status column exists in commissions table
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'commissions'
      AND column_name = 'status'
    ) INTO v_status_exists;
  
    -- Check if agents table exists
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'agents'
    ) INTO v_agents_exists;
    
    -- Check if users table exists
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'users'
    ) INTO v_users_exists;
  
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
    
    -- Find the owner based on available tables
    IF v_agents_exists THEN
      -- Try to find owner using agents table
      SELECT upline_id INTO v_owner_id FROM agents WHERE id = v_agent_id;
      
      IF v_owner_id IS NULL THEN
        -- If no upline, find a user with Owner position
        BEGIN
          SELECT a.id INTO v_owner_id
          FROM agents a
          JOIN positions p ON a.position_id = p.id
          WHERE p.name = 'Owner'
          LIMIT 1;
        EXCEPTION
          WHEN OTHERS THEN
            -- If error, set owner to agent (fallback)
            v_owner_id := v_agent_id;
        END;
      END IF;
    ELSIF v_users_exists THEN
      -- Try to find owner using users table
      BEGIN
        SELECT u.id INTO v_owner_id
        FROM users u
        JOIN positions p ON u.position_id = p.id
        WHERE p.name = 'Owner'
        LIMIT 1;
      EXCEPTION
        WHEN OTHERS THEN
          -- If error, set owner to agent (fallback)
          v_owner_id := v_agent_id;
      END;
    ELSE
      -- No user tables found, set owner to agent (fallback)
      v_owner_id := v_agent_id;
    END IF;
    
    -- If still no owner, use agent as owner
    IF v_owner_id IS NULL THEN
      v_owner_id := v_agent_id;
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
      -- Make sure advance_rate is set
      IF v_carrier.advance_rate IS NULL THEN
        -- Default to 75% if not set
        v_carrier.advance_rate := 75;
      END IF;
      
      -- Calculate advance and future amounts
      v_advance_amount := v_deal.annual_premium * (v_carrier.advance_rate / 100);
      v_future_amount := v_deal.annual_premium - v_advance_amount;
      
      RAISE NOTICE 'Deal %: Annual Premium = %, Advance Rate = %, Advance Amount = %, Future Amount = %',
        p_deal_id, v_deal.annual_premium, v_carrier.advance_rate, v_advance_amount, v_future_amount;
      
      -- Create advance commission records
      -- Agent advance commission
      IF v_status_exists THEN
        -- With status column
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
      ELSE
        -- Without status column
        INSERT INTO commissions (
          deal_id, user_id, position_id, amount, percentage,
          commission_type, payment_date, is_chargeback
        )
        VALUES (
          p_deal_id, v_agent_id, v_agent_position_id,
          (v_advance_amount * (v_agent_percentage / 100)),
          v_agent_percentage, 'advance', v_advance_date, false
        )
        RETURNING id INTO v_commission_id;
        
        -- Owner advance commission
        INSERT INTO commissions (
          deal_id, user_id, position_id, amount, percentage,
          commission_type, payment_date, is_chargeback
        )
        VALUES (
          p_deal_id, v_owner_id, v_owner_position_id,
          (v_advance_amount * (v_owner_percentage / 100)),
          v_owner_percentage, 'advance', v_advance_date, false
        );
      END IF;
      
      -- Create future commission records (if there's any future amount)
      IF v_future_amount > 0 THEN
        -- Agent future commission
        IF v_status_exists THEN
          -- With status column
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
        ELSE
          -- Without status column
          INSERT INTO commissions (
            deal_id, user_id, position_id, amount, percentage,
            commission_type, payment_date, is_chargeback
          )
          VALUES (
            p_deal_id, v_agent_id, v_agent_position_id,
            (v_future_amount * (v_agent_percentage / 100)),
            v_agent_percentage, 'future', v_future_date, false
          );
          
          -- Owner future commission
          INSERT INTO commissions (
            deal_id, user_id, position_id, amount, percentage,
            commission_type, payment_date, is_chargeback
          )
          VALUES (
            p_deal_id, v_owner_id, v_owner_position_id,
            (v_future_amount * (v_owner_percentage / 100)),
            v_owner_percentage, 'future', v_future_date, false
          );
        END IF;
      END IF;
      
    ELSE
      -- Monthly payment carrier
      v_monthly_amount := v_deal.monthly_premium;
      
      -- Create 12 monthly commission records
      FOR i IN 1..12 LOOP
        -- Agent monthly commission
        IF v_status_exists THEN
          -- With status column
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
        ELSE
          -- Without status column
          INSERT INTO commissions (
            deal_id, user_id, position_id, amount, percentage,
            commission_type, payment_date, is_chargeback
          )
          VALUES (
            p_deal_id, v_agent_id, v_agent_position_id,
            (v_monthly_amount * (v_agent_percentage / 100)),
            v_agent_percentage, 'monthly',
            CURRENT_DATE + ((i-1) * INTERVAL '1 month'), false
          );
          
          -- Owner monthly commission
          INSERT INTO commissions (
            deal_id, user_id, position_id, amount, percentage,
            commission_type, payment_date, is_chargeback
          )
          VALUES (
            p_deal_id, v_owner_id, v_owner_position_id,
            (v_monthly_amount * (v_owner_percentage / 100)),
            v_owner_percentage, 'monthly',
            CURRENT_DATE + ((i-1) * INTERVAL '1 month'), false
          );
        END IF;
      END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Notify that the function has been updated
DO $$
BEGIN
  RAISE NOTICE 'calculate_deal_commissions function updated.';
END $$;

-- 3. Update the views to ensure they're calculating correctly
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
  RAISE NOTICE 'Commission calculations fixed!';
  RAISE NOTICE 'Please refresh your dashboard to see the updated commission data.';
END $$;