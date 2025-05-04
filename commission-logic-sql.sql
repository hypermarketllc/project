-- Commission Logic Implementation SQL Script
-- Run this script directly in the Supabase SQL Editor
--
-- IMPORTANT: This script implements the commission logic based on the requirements
-- in the commission-logic-guide.md document. It includes:
--
-- 1. Database schema updates (new columns and tables)
-- 2. Functions for commission calculation and chargeback processing
-- 3. Triggers for automatic commission calculation and status changes
-- 4. Views for dashboard metrics
--
-- If you encounter any errors while running this script:
-- 1. Read the error message carefully
-- 2. You can run sections of the script individually if needed
-- 3. The script has been designed to handle existing data gracefully
--
-- After running this script, you can test the commission logic by:
-- 1. Creating a new deal (commissions will be calculated automatically)
-- 2. Updating a deal's status to 'lapsed' (chargebacks will be processed)
-- 3. Updating a lapsed deal's status to 'active' (policy will be reinstated)

-- 1. Update Carrier table with payment type and advance period fields
ALTER TABLE carriers 
ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'advance' CHECK (payment_type IN ('advance', 'monthly')),
ADD COLUMN IF NOT EXISTS advance_period_months INTEGER NOT NULL DEFAULT 9;

-- 2. Ensure Position table has Agent and Owner positions with correct levels
-- First, check if positions already exist
DO $$
DECLARE
  v_agent_exists BOOLEAN;
  v_owner_exists BOOLEAN;
  v_agent_id UUID;
  v_owner_id UUID;
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

-- 5. Create a function to process chargebacks
CREATE OR REPLACE FUNCTION process_chargeback(p_deal_id UUID)
RETURNS VOID AS $$
DECLARE
  v_deal RECORD;
  v_carrier RECORD;
  v_advance_end_date DATE;
  v_commission RECORD;
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
        IF v_status_exists THEN
          -- With status column
          INSERT INTO commissions (
            deal_id, user_id, position_id, amount, percentage, status,
            commission_type, payment_date, is_chargeback, chargeback_date, original_commission_id
          )
          VALUES (
            p_deal_id, v_commission.user_id, v_commission.position_id,
            -v_commission.amount, v_commission.percentage, 'pending',
            'advance', CURRENT_DATE, true, CURRENT_DATE, v_commission.id
          );
        ELSE
          -- Without status column
          INSERT INTO commissions (
            deal_id, user_id, position_id, amount, percentage,
            commission_type, payment_date, is_chargeback, chargeback_date, original_commission_id
          )
          VALUES (
            p_deal_id, v_commission.user_id, v_commission.position_id,
            -v_commission.amount, v_commission.percentage,
            'advance', CURRENT_DATE, true, CURRENT_DATE, v_commission.id
          );
        END IF;
      END LOOP;
      
      -- Cancel all future commissions
      IF v_status_exists THEN
        -- With status column
        UPDATE commissions
        SET status = 'cancelled'
        WHERE deal_id = p_deal_id
        AND commission_type = 'future'
        AND payment_date > CURRENT_DATE;
      END IF;
    ELSE
      -- Policy lapsed after advance period, just cancel future commissions
      IF v_status_exists THEN
        -- With status column
        UPDATE commissions
        SET status = 'cancelled'
        WHERE deal_id = p_deal_id
        AND commission_type IN ('future', 'monthly')
        AND payment_date > CURRENT_DATE;
      END IF;
    END IF;
  ELSE
    -- For monthly carriers, just cancel future commissions
    IF v_status_exists THEN
      -- With status column
      UPDATE commissions
      SET status = 'cancelled'
      WHERE deal_id = p_deal_id
      AND commission_type = 'monthly'
      AND payment_date > CURRENT_DATE;
    END IF;
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
  
  -- Update deal status to active
  UPDATE deals
  SET status = 'active',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_deal_id;
  
  -- Reactivate future commissions that were cancelled
  IF v_status_exists THEN
    UPDATE commissions
    SET status = 'pending'
    WHERE deal_id = p_deal_id
    AND status = 'cancelled'
    AND payment_date > CURRENT_DATE;
  END IF;
  
  -- Note: We don't reverse chargebacks that have already been processed
END;
$$ LANGUAGE plpgsql;

-- 7. Create a trigger to calculate commissions when a deal is created
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

-- Check if agents table exists and if commissions table has status column
DO $$
DECLARE
  v_agents_exists BOOLEAN;
  v_users_exists BOOLEAN;
  v_status_exists BOOLEAN;
BEGIN
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
  
  -- Check if status column exists in commissions table
  SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'commissions'
    AND column_name = 'status'
  ) INTO v_status_exists;
  
  -- Create appropriate views based on available tables and columns
  IF v_status_exists THEN
    -- Status column exists
    IF v_agents_exists THEN
      -- Use agents table with status column
      EXECUTE '
      CREATE OR REPLACE VIEW total_commission AS
      SELECT
        c.user_id,
        u.full_name AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.status = ''paid'' THEN c.amount ELSE 0 END) AS paid_commission,
        SUM(CASE WHEN c.status = ''pending'' AND c.payment_date <= CURRENT_DATE THEN c.amount ELSE 0 END) AS pending_commission,
        SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS chargebacks,
        SUM(CASE
          WHEN (c.status = ''paid'' OR (c.status = ''pending'' AND c.payment_date <= CURRENT_DATE))
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
        SUM(CASE WHEN c.status = ''pending'' AND c.payment_date > CURRENT_DATE THEN c.amount ELSE 0 END) AS future_commission
      FROM commissions c
      JOIN agents u ON c.user_id = u.id
      JOIN positions p ON c.position_id = p.id
      WHERE c.status = ''pending'' AND c.payment_date > CURRENT_DATE
      GROUP BY c.user_id, u.full_name, p.name;
      ';
    ELSIF v_users_exists THEN
      -- Use users table with status column
      EXECUTE '
      CREATE OR REPLACE VIEW total_commission AS
      SELECT
        c.user_id,
        u.full_name AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.status = ''paid'' THEN c.amount ELSE 0 END) AS paid_commission,
        SUM(CASE WHEN c.status = ''pending'' AND c.payment_date <= CURRENT_DATE THEN c.amount ELSE 0 END) AS pending_commission,
        SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS chargebacks,
        SUM(CASE
          WHEN (c.status = ''paid'' OR (c.status = ''pending'' AND c.payment_date <= CURRENT_DATE))
          THEN c.amount
          ELSE 0
        END) + SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS net_commission
      FROM commissions c
      JOIN users u ON c.user_id = u.id
      JOIN positions p ON c.position_id = p.id
      GROUP BY c.user_id, u.full_name, p.name;
      
      CREATE OR REPLACE VIEW future_commission AS
      SELECT
        c.user_id,
        u.full_name AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.status = ''pending'' AND c.payment_date > CURRENT_DATE THEN c.amount ELSE 0 END) AS future_commission
      FROM commissions c
      JOIN users u ON c.user_id = u.id
      JOIN positions p ON c.position_id = p.id
      WHERE c.status = ''pending'' AND c.payment_date > CURRENT_DATE
      GROUP BY c.user_id, u.full_name, p.name;
      ';
    ELSE
      -- No user tables, but status column exists
      EXECUTE '
      CREATE OR REPLACE VIEW total_commission AS
      SELECT
        c.user_id,
        ''Unknown'' AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.status = ''paid'' THEN c.amount ELSE 0 END) AS paid_commission,
        SUM(CASE WHEN c.status = ''pending'' AND c.payment_date <= CURRENT_DATE THEN c.amount ELSE 0 END) AS pending_commission,
        SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS chargebacks,
        SUM(CASE
          WHEN (c.status = ''paid'' OR (c.status = ''pending'' AND c.payment_date <= CURRENT_DATE))
          THEN c.amount
          ELSE 0
        END) + SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS net_commission
      FROM commissions c
      JOIN positions p ON c.position_id = p.id
      GROUP BY c.user_id, p.name;
      
      CREATE OR REPLACE VIEW future_commission AS
      SELECT
        c.user_id,
        ''Unknown'' AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.status = ''pending'' AND c.payment_date > CURRENT_DATE THEN c.amount ELSE 0 END) AS future_commission
      FROM commissions c
      JOIN positions p ON c.position_id = p.id
      WHERE c.status = ''pending'' AND c.payment_date > CURRENT_DATE
      GROUP BY c.user_id, p.name;
      ';
    END IF;
  ELSE
    -- Status column doesn't exist, use payment_date and is_chargeback only
    IF v_agents_exists THEN
      -- Use agents table without status column
      EXECUTE '
      CREATE OR REPLACE VIEW total_commission AS
      SELECT
        c.user_id,
        u.full_name AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.payment_date <= CURRENT_DATE AND NOT c.is_chargeback THEN c.amount ELSE 0 END) AS earned_commission,
        SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS chargebacks,
        SUM(CASE
          WHEN c.payment_date <= CURRENT_DATE OR c.is_chargeback = true
          THEN c.amount
          ELSE 0
        END) AS net_commission
      FROM commissions c
      JOIN agents u ON c.user_id = u.id
      JOIN positions p ON c.position_id = p.id
      GROUP BY c.user_id, u.full_name, p.name;
      
      CREATE OR REPLACE VIEW future_commission AS
      SELECT
        c.user_id,
        u.full_name AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.payment_date > CURRENT_DATE AND NOT c.is_chargeback THEN c.amount ELSE 0 END) AS future_commission
      FROM commissions c
      JOIN agents u ON c.user_id = u.id
      JOIN positions p ON c.position_id = p.id
      WHERE c.payment_date > CURRENT_DATE AND NOT c.is_chargeback
      GROUP BY c.user_id, u.full_name, p.name;
      ';
    ELSIF v_users_exists THEN
      -- Use users table without status column
      EXECUTE '
      CREATE OR REPLACE VIEW total_commission AS
      SELECT
        c.user_id,
        u.full_name AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.payment_date <= CURRENT_DATE AND NOT c.is_chargeback THEN c.amount ELSE 0 END) AS earned_commission,
        SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS chargebacks,
        SUM(CASE
          WHEN c.payment_date <= CURRENT_DATE OR c.is_chargeback = true
          THEN c.amount
          ELSE 0
        END) AS net_commission
      FROM commissions c
      JOIN users u ON c.user_id = u.id
      JOIN positions p ON c.position_id = p.id
      GROUP BY c.user_id, u.full_name, p.name;
      
      CREATE OR REPLACE VIEW future_commission AS
      SELECT
        c.user_id,
        u.full_name AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.payment_date > CURRENT_DATE AND NOT c.is_chargeback THEN c.amount ELSE 0 END) AS future_commission
      FROM commissions c
      JOIN users u ON c.user_id = u.id
      JOIN positions p ON c.position_id = p.id
      WHERE c.payment_date > CURRENT_DATE AND NOT c.is_chargeback
      GROUP BY c.user_id, u.full_name, p.name;
      ';
    ELSE
      -- No user tables and no status column
      EXECUTE '
      CREATE OR REPLACE VIEW total_commission AS
      SELECT
        c.user_id,
        ''Unknown'' AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.payment_date <= CURRENT_DATE AND NOT c.is_chargeback THEN c.amount ELSE 0 END) AS earned_commission,
        SUM(CASE WHEN c.is_chargeback = true THEN c.amount ELSE 0 END) AS chargebacks,
        SUM(CASE
          WHEN c.payment_date <= CURRENT_DATE OR c.is_chargeback = true
          THEN c.amount
          ELSE 0
        END) AS net_commission
      FROM commissions c
      JOIN positions p ON c.position_id = p.id
      GROUP BY c.user_id, p.name;
      
      CREATE OR REPLACE VIEW future_commission AS
      SELECT
        c.user_id,
        ''Unknown'' AS agent_name,
        p.name AS position,
        SUM(CASE WHEN c.payment_date > CURRENT_DATE AND NOT c.is_chargeback THEN c.amount ELSE 0 END) AS future_commission
      FROM commissions c
      JOIN positions p ON c.position_id = p.id
      WHERE c.payment_date > CURRENT_DATE AND NOT c.is_chargeback
      GROUP BY c.user_id, p.name;
      ';
    END IF;
  END IF;
END $$;

-- Add comments to explain the functions
COMMENT ON FUNCTION calculate_deal_commissions IS 'Calculates commissions for a deal based on carrier payment type, advance rate, and commission percentages';
COMMENT ON FUNCTION process_chargeback IS 'Processes chargebacks when a policy lapses, creating chargeback records and cancelling future commissions';
COMMENT ON FUNCTION reinstate_policy IS 'Reinstates a policy, reactivating future commissions';
COMMENT ON FUNCTION trigger_calculate_commissions IS 'Trigger function to calculate commissions when a deal is created';
COMMENT ON FUNCTION trigger_process_chargeback IS 'Trigger function to process chargebacks when a deal status changes to lapsed';

-- Test the commission logic with a sample deal (optional)
DO $$
DECLARE
  v_carrier_id UUID;
  v_product_id UUID;
  v_agent_id UUID;
  v_owner_id UUID;
  v_agent_position_id UUID;
  v_owner_position_id UUID;
  v_deal_id UUID;
  v_create_test BOOLEAN := false; -- Set to true to create a test deal
BEGIN
  -- Only create test deal if explicitly enabled
  IF NOT v_create_test THEN
    RAISE NOTICE 'Test deal creation is disabled. Set v_create_test to true to enable.';
    RETURN;
  END IF;

  -- Get position IDs
  SELECT id INTO v_agent_position_id FROM positions WHERE name = 'Agent';
  SELECT id INTO v_owner_position_id FROM positions WHERE name = 'Owner';
  
  IF v_agent_position_id IS NULL OR v_owner_position_id IS NULL THEN
    RAISE NOTICE 'Cannot create test deal: Agent or Owner position not found';
    RETURN;
  END IF;

  -- Get a carrier ID
  SELECT id INTO v_carrier_id FROM carriers LIMIT 1;
  
  -- Get a product ID for the carrier
  SELECT id INTO v_product_id
  FROM products
  WHERE carrier_id = v_carrier_id
  LIMIT 1;
  
  -- Get an agent ID
  SELECT id INTO v_agent_id
  FROM agents
  WHERE position_id = v_agent_position_id
  LIMIT 1;
  
  -- If no agent with Agent position, get any agent
  IF v_agent_id IS NULL THEN
    SELECT id INTO v_agent_id FROM agents LIMIT 1;
    
    -- Update agent with Agent position
    IF v_agent_id IS NOT NULL THEN
      UPDATE agents SET position_id = v_agent_position_id WHERE id = v_agent_id;
    END IF;
  END IF;
  
  -- Get an owner ID
  SELECT id INTO v_owner_id
  FROM agents
  WHERE position_id = v_owner_position_id
  LIMIT 1;
  
  -- If no owner found, create upline relationship
  IF v_owner_id IS NOT NULL AND v_agent_id IS NOT NULL THEN
    UPDATE agents SET upline_id = v_owner_id WHERE id = v_agent_id;
  END IF;
  
  IF v_carrier_id IS NULL OR v_product_id IS NULL OR v_agent_id IS NULL THEN
    RAISE NOTICE 'Cannot create test deal: missing carrier, product, or agent';
    RETURN;
  END IF;
  
  -- Update carrier with payment type and advance period
  UPDATE carriers
  SET payment_type = 'advance',
      advance_rate = 75,
      advance_period_months = 9
  WHERE id = v_carrier_id;
  
  -- Create commission split for the product if it doesn't exist
  INSERT INTO commission_splits (position_id, product_id, percentage)
  VALUES (v_agent_position_id, v_product_id, 40)
  ON CONFLICT (position_id, product_id) DO UPDATE
  SET percentage = 40;
  
  BEGIN
    -- Create a test deal
    INSERT INTO deals (
      agent_id, carrier_id, product_id, client_name,
      monthly_premium, annual_premium, status
    )
    VALUES (
      v_agent_id, v_carrier_id, v_product_id, 'Test Client',
      100, 1200, 'active'
    )
    RETURNING id INTO v_deal_id;
    
    RAISE NOTICE 'Created test deal with ID: %', v_deal_id;
    RAISE NOTICE 'Commissions have been calculated automatically';
    RAISE NOTICE 'You can view the commissions with: SELECT * FROM commissions WHERE deal_id = ''%''', v_deal_id;
    RAISE NOTICE 'You can test policy lapse with: UPDATE deals SET status = ''lapsed'' WHERE id = ''%''', v_deal_id;
    RAISE NOTICE 'You can test policy reinstatement with: UPDATE deals SET status = ''active'' WHERE id = ''%''', v_deal_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error creating test deal: %', SQLERRM;
  END;
END $$;

-- Print success message
DO $$
BEGIN
  RAISE NOTICE 'Commission logic implementation complete!';
  RAISE NOTICE 'The following features have been implemented:';
  RAISE NOTICE '1. Support for both advance and monthly payment carriers';
  RAISE NOTICE '2. Automatic commission calculation based on carrier type and rates';
  RAISE NOTICE '3. Chargeback processing for lapsed policies';
  RAISE NOTICE '4. Policy reinstatement handling';
  RAISE NOTICE '5. Dashboard views for commission metrics';
END $$;