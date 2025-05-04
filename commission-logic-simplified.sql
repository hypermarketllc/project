-- Commission Logic Implementation SQL Script (Simplified Version)
-- Run this script directly in the Supabase SQL Editor

-- 1. Update Carrier table with payment type and advance period fields
ALTER TABLE carriers 
ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'advance' CHECK (payment_type IN ('advance', 'monthly')),
ADD COLUMN IF NOT EXISTS advance_period_months INTEGER NOT NULL DEFAULT 9;

-- 2. Ensure Position table has Agent and Owner positions with correct levels
DO $$
DECLARE
  v_agent_exists BOOLEAN;
  v_owner_exists BOOLEAN;
BEGIN
  -- Check if Agent position exists
  SELECT EXISTS (SELECT 1 FROM positions WHERE name = 'Agent') INTO v_agent_exists;
  
  -- Check if Owner position exists
  SELECT EXISTS (SELECT 1 FROM positions WHERE name = 'Owner') INTO v_owner_exists;
  
  -- Update Agent position if it exists, otherwise insert it
  IF v_agent_exists THEN
    UPDATE positions SET level = 1, description = 'Agent who closes the deal' WHERE name = 'Agent';
  ELSE
    INSERT INTO positions (id, name, level, description)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Agent', 1, 'Agent who closes the deal');
  END IF;
  
  -- Update Owner position if it exists, otherwise insert it
  IF v_owner_exists THEN
    UPDATE positions SET level = 2, description = 'Agency owner' WHERE name = 'Owner';
  ELSE
    INSERT INTO positions (id, name, level, description)
    VALUES ('00000000-0000-0000-0000-000000000002', 'Owner', 2, 'Agency owner');
  END IF;
END $$;

-- 3. Update Commission table with additional fields
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'advance' CHECK (commission_type IN ('advance', 'future', 'monthly')),
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS is_chargeback BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS chargeback_date DATE,
ADD COLUMN IF NOT EXISTS original_commission_id UUID REFERENCES commissions(id);

-- 4. Create a function to calculate commissions for a deal
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
  v_status_exists BOOLEAN;
BEGIN
  -- Check if status column exists in commissions table
  SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'commissions'
    AND column_name = 'status'
  ) INTO v_status_exists;

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
  BEGIN
    SELECT upline_id INTO v_owner_id FROM agents WHERE id = v_agent_id;
  EXCEPTION
    WHEN OTHERS THEN
      v_owner_id := NULL;
  END;
  
  -- If no upline, find a user with Owner position
  IF v_owner_id IS NULL THEN
    BEGIN
      SELECT a.id INTO v_owner_id 
      FROM agents a
      JOIN positions p ON a.position_id = p.id
      WHERE p.name = 'Owner'
      LIMIT 1;
    EXCEPTION
      WHEN OTHERS THEN
        v_owner_id := v_agent_id;
    END;
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
  BEGIN
    SELECT percentage INTO v_agent_percentage
    FROM commission_splits
    WHERE position_id = v_agent_position_id AND product_id = v_deal.product_id;
  EXCEPTION
    WHEN OTHERS THEN
      v_agent_percentage := NULL;
  END;
  
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

-- 5. Create a trigger to calculate commissions when a deal is created
CREATE OR REPLACE FUNCTION trigger_calculate_commissions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_deal_commissions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deal_commission_trigger ON deals;
CREATE TRIGGER deal_commission_trigger
AFTER INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION trigger_calculate_commissions();

-- 6. Create a view for dashboard metrics
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

-- Print success message
DO $$
BEGIN
  RAISE NOTICE 'Commission logic implementation complete!';
  RAISE NOTICE 'The following features have been implemented:';
  RAISE NOTICE '1. Support for both advance and monthly payment carriers';
  RAISE NOTICE '2. Automatic commission calculation based on carrier type and rates';
  RAISE NOTICE '3. Dashboard view for commission metrics';
END $$;