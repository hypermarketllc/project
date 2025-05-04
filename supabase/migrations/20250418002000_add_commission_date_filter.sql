-- Migration: Add Commission Date Filter Functions
-- This migration creates stored procedures to filter commission data by date

-- Function to get money in production with date filter
CREATE OR REPLACE FUNCTION get_money_in_production(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  user_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  total_advance NUMERIC,
  total_monthly NUMERIC,
  total_chargebacks NUMERIC,
  net_production NUMERIC
) AS $$
DECLARE
  query_text TEXT;
BEGIN
  query_text := '
    SELECT 
      SUM(CASE 
        WHEN (c.commission_type = ''advance'' OR c.commission_type IS NULL) AND COALESCE(c.is_chargeback, false) = false 
        THEN c.amount ELSE 0 
      END) AS total_advance,
      
      SUM(CASE 
        WHEN c.commission_type = ''monthly'' AND COALESCE(c.is_chargeback, false) = false 
        AND (c.payment_date <= CURRENT_DATE OR c.payment_date IS NULL) 
        THEN c.amount ELSE 0 
      END) AS total_monthly,
      
      SUM(CASE 
        WHEN COALESCE(c.is_chargeback, false) = true 
        THEN c.amount ELSE 0 
      END) AS total_chargebacks,
      
      SUM(CASE 
        WHEN (
          (c.commission_type IN (''advance'', ''monthly'') OR c.commission_type IS NULL) 
          AND COALESCE(c.is_chargeback, false) = false 
          AND (c.payment_date <= CURRENT_DATE OR c.payment_date IS NULL)
        ) OR COALESCE(c.is_chargeback, false) = true
        THEN c.amount 
        ELSE 0 
      END) AS net_production
    FROM commissions c
    WHERE 1=1
  ';
  
  -- Add date filter if provided
  IF start_date IS NOT NULL AND end_date IS NOT NULL THEN
    query_text := query_text || ' AND (c.payment_date BETWEEN ' || quote_literal(start_date) || ' AND ' || quote_literal(end_date) || ')';
  END IF;
  
  -- Add user filter if provided
  IF user_id_param IS NOT NULL THEN
    query_text := query_text || ' AND c.user_id = ' || quote_literal(user_id_param);
  END IF;
  
  -- Execute the dynamic query
  RETURN QUERY EXECUTE query_text;
END;
$$ LANGUAGE plpgsql;

-- Function to get total commission with date filter
CREATE OR REPLACE FUNCTION get_total_commission(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  user_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  agent_name TEXT,
  "position" TEXT,
  paid_commission NUMERIC,
  pending_commission NUMERIC,
  chargebacks NUMERIC,
  net_commission NUMERIC
) AS $$
DECLARE
  query_text TEXT;
BEGIN
  query_text := '
    SELECT
      c.user_id,
      COALESCE(u.full_name, ''Unknown User'') AS agent_name,
      COALESCE(p.name, ''Unknown Position'') AS "position",
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
        WHEN COALESCE(c.is_chargeback, false) = true 
        THEN c.amount ELSE 0 
      END) AS chargebacks,
      
      SUM(CASE 
        WHEN (c.payment_date <= CURRENT_DATE OR c.payment_date IS NULL) 
        OR COALESCE(c.is_chargeback, false) = true
        THEN c.amount 
        ELSE 0 
      END) AS net_commission
    FROM commissions c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN positions p ON c.position_id = p.id
    WHERE 1=1
  ';
  
  -- Add date filter if provided
  IF start_date IS NOT NULL AND end_date IS NOT NULL THEN
    query_text := query_text || ' AND (c.payment_date BETWEEN ' || quote_literal(start_date) || ' AND ' || quote_literal(end_date) || ')';
  END IF;
  
  -- Add user filter if provided
  IF user_id_param IS NOT NULL THEN
    query_text := query_text || ' AND c.user_id = ' || quote_literal(user_id_param);
  END IF;
  
  -- Add group by clause
  query_text := query_text || ' GROUP BY c.user_id, u.full_name, p.name';
  
  -- Execute the dynamic query
  RETURN QUERY EXECUTE query_text;
END;
$$ LANGUAGE plpgsql;

-- Function to get future commission with date filter
CREATE OR REPLACE FUNCTION get_future_commission(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  user_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  agent_name TEXT,
  "position" TEXT,
  future_commission NUMERIC
) AS $$
DECLARE
  query_text TEXT;
BEGIN
  query_text := '
    SELECT
      c.user_id,
      COALESCE(u.full_name, ''Unknown User'') AS agent_name,
      COALESCE(p.name, ''Unknown Position'') AS "position",
      SUM(CASE 
        WHEN c.payment_date > CURRENT_DATE 
        AND COALESCE(c.is_chargeback, false) = false 
        THEN c.amount ELSE 0 
      END) AS future_commission
    FROM commissions c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN positions p ON c.position_id = p.id
    WHERE c.payment_date > CURRENT_DATE AND COALESCE(c.is_chargeback, false) = false
  ';
  
  -- Add date filter if provided (for future dates beyond the current filter)
  IF start_date IS NOT NULL AND end_date IS NOT NULL THEN
    query_text := query_text || ' AND (c.payment_date > ' || quote_literal(end_date) || ')';
  END IF;
  
  -- Add user filter if provided
  IF user_id_param IS NOT NULL THEN
    query_text := query_text || ' AND c.user_id = ' || quote_literal(user_id_param);
  END IF;
  
  -- Add group by clause
  query_text := query_text || ' GROUP BY c.user_id, u.full_name, p.name';
  
  -- Execute the dynamic query
  RETURN QUERY EXECUTE query_text;
END;
$$ LANGUAGE plpgsql;

-- Print success message
DO $$
BEGIN
  RAISE NOTICE 'Commission date filter functions created successfully!';
  RAISE NOTICE 'You can now filter commission data by date using the following functions:';
  RAISE NOTICE '1. get_money_in_production(start_date, end_date, user_id)';
  RAISE NOTICE '2. get_total_commission(start_date, end_date, user_id)';
  RAISE NOTICE '3. get_future_commission(start_date, end_date, user_id)';
END $$;