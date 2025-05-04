-- Migration: Ensure Commission Posting
-- This migration ensures that commission numbers are posted when the policy gets posted

-- 1. Ensure the trigger for commission calculation exists
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  -- Check if the trigger exists
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'deal_commission_trigger'
  ) INTO v_trigger_exists;
  
  -- If trigger doesn't exist, create it
  IF NOT v_trigger_exists THEN
    RAISE NOTICE 'Creating deal_commission_trigger...';
    
    -- First create the trigger function if it doesn't exist
    CREATE OR REPLACE FUNCTION trigger_calculate_commissions()
    RETURNS TRIGGER AS $$
    BEGIN
      PERFORM calculate_deal_commissions(NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Then create the trigger
    CREATE TRIGGER deal_commission_trigger
    AFTER INSERT ON deals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_commissions();
  ELSE
    RAISE NOTICE 'deal_commission_trigger already exists.';
  END IF;
END $$;

-- 2. Ensure the trigger for status changes exists
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  -- Check if the trigger exists
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'deal_status_trigger'
  ) INTO v_trigger_exists;
  
  -- If trigger doesn't exist, create it
  IF NOT v_trigger_exists THEN
    RAISE NOTICE 'Creating deal_status_trigger...';
    
    -- First create the trigger function if it doesn't exist
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
    
    -- Then create the trigger
    CREATE TRIGGER deal_status_trigger
    AFTER UPDATE OF status ON deals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_process_chargeback();
  ELSE
    RAISE NOTICE 'deal_status_trigger already exists.';
  END IF;
END $$;

-- 3. Ensure the calculate_deal_commissions function exists
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  -- Check if the function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'calculate_deal_commissions'
  ) INTO v_function_exists;
  
  -- If function doesn't exist, raise a notice
  IF NOT v_function_exists THEN
    RAISE NOTICE 'calculate_deal_commissions function does not exist. Please run the commission-logic-sql.sql script first.';
  ELSE
    RAISE NOTICE 'calculate_deal_commissions function exists.';
  END IF;
END $$;

-- 4. Recalculate commissions for existing deals if needed
DO $$
DECLARE
  v_deal RECORD;
  v_commission_exists BOOLEAN;
BEGIN
  -- Check if we need to recalculate commissions
  SELECT EXISTS (
    SELECT 1 FROM commissions LIMIT 1
  ) INTO v_commission_exists;
  
  -- Only recalculate if there are no commission records
  IF NOT v_commission_exists THEN
    RAISE NOTICE 'No commission records found. Calculating commissions for existing deals...';
    
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
    
    RAISE NOTICE 'Commission calculation complete.';
  ELSE
    RAISE NOTICE 'Commission records already exist. Skipping recalculation.';
  END IF;
END $$;

-- Print success message
DO $$
BEGIN
  RAISE NOTICE 'Commission posting verification complete!';
  RAISE NOTICE 'Commission numbers will be posted when policies are posted.';
END $$;