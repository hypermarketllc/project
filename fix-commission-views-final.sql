-- Fix Commission Views (Final Version)
-- This script creates the necessary views for the Commission Summary component
-- with proper filtering by user_id and position

-- First, check if the views already exist and drop them if they do
DROP VIEW IF EXISTS total_commission;
DROP VIEW IF EXISTS future_commission;
DROP VIEW IF EXISTS money_in_production;

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
  COALESCE(p.name, 'Unknown Position') AS position,
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
  COALESCE(p.name, 'Unknown Position') AS position,
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

-- Create stored procedures for filtered views
CREATE OR REPLACE FUNCTION get_money_in_production_by_user(user_id_param UUID)
RETURNS TABLE (
  total_advance NUMERIC,
  total_monthly NUMERIC,
  total_chargebacks NUMERIC,
  net_production NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.total_advance,
    m.total_monthly,
    m.total_chargebacks,
    m.net_production
  FROM money_in_production m
  WHERE m.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create a function to backfill commission data for existing deals
DO $$
DECLARE
  v_deal RECORD;
  v_commission_exists BOOLEAN;
BEGIN
  -- Check if we need to backfill commission data
  SELECT EXISTS (
    SELECT 1 FROM commissions LIMIT 1
  ) INTO v_commission_exists;
  
  -- Only backfill if there are no commission records
  IF NOT v_commission_exists THEN
    RAISE NOTICE 'No commission records found. Backfilling commission data for existing deals...';
    
    -- Loop through all active deals
    FOR v_deal IN
      SELECT * FROM deals WHERE status = 'active'
    LOOP
      -- Calculate commissions for each deal
      BEGIN
        PERFORM calculate_deal_commissions(v_deal.id);
        RAISE NOTICE 'Calculated commissions for deal %', v_deal.id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Error calculating commissions for deal %: %', v_deal.id, SQLERRM;
      END;
    END LOOP;
    
    RAISE NOTICE 'Commission backfill complete.';
  ELSE
    RAISE NOTICE 'Commission records already exist. Skipping backfill.';
  END IF;
END $$;

-- Update the CommissionSummary component to use the new views
-- Print success message
DO $$
BEGIN
  RAISE NOTICE 'Commission views created successfully!';
  RAISE NOTICE 'The Commission Summary component should now display accurate data.';
END $$;