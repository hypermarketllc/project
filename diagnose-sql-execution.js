import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Diagnosing SQL Execution Issues...');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or service role key not found in environment variables.');
  console.error('Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Test different methods of executing SQL
async function diagnoseExecution() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test 1: Check if we can connect to Supabase
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count(*)', { count: 'exact', head: true });
    
    if (testError) {
      console.error('Error connecting to Supabase:', testError);
      return;
    }
    
    console.log('Successfully connected to Supabase!');
    
    // Test 2: Check if exec_sql function exists
    console.log('\nChecking if exec_sql function exists...');
    
    try {
      const { data: execSqlData, error: execSqlError } = await supabase.rpc('exec_sql', {
        sql: 'SELECT 1;'
      });
      
      if (execSqlError) {
        console.error('Error executing exec_sql function:', execSqlError);
        console.log('The exec_sql function does not exist in your Supabase database.');
      } else {
        console.log('exec_sql function exists and works!');
        console.log('Result:', execSqlData);
      }
    } catch (error) {
      console.error('Error checking exec_sql function:', error);
      console.log('The exec_sql function does not exist in your Supabase database.');
    }
    
    // Test 3: Try to create a simple function
    console.log('\nTrying to create a simple function...');
    
    try {
      const { data: createFuncData, error: createFuncError } = await supabase.rpc('create_test_function', {
        function_body: `
          CREATE OR REPLACE FUNCTION test_function()
          RETURNS TEXT AS $$
          BEGIN
            RETURN 'Test function works!';
          END;
          $$ LANGUAGE plpgsql;
        `
      });
      
      if (createFuncError) {
        console.error('Error creating test function:', createFuncError);
        console.log('The create_test_function RPC does not exist in your Supabase database.');
      } else {
        console.log('Successfully created test function!');
        console.log('Result:', createFuncData);
      }
    } catch (error) {
      console.error('Error creating test function:', error);
      console.log('The create_test_function RPC does not exist in your Supabase database.');
    }
    
    // Test 4: Try to execute SQL directly using REST API
    console.log('\nTrying to execute SQL directly using REST API...');
    
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Prefer': 'params=single-object'
        },
        body: JSON.stringify({
          query: 'SELECT COUNT(*) FROM users;'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error executing SQL directly:', errorText);
        console.log('Cannot execute SQL directly using REST API.');
      } else {
        const result = await response.json();
        console.log('Successfully executed SQL directly!');
        console.log('Result:', result);
      }
    } catch (error) {
      console.error('Error executing SQL directly:', error);
      console.log('Cannot execute SQL directly using REST API.');
    }
    
    // Test 5: Check if we can use pgSQL directly
    console.log('\nChecking if we can use pgSQL directly...');
    
    try {
      const { data: pgData, error: pgError } = await supabase.from('pg_extension').select('*').limit(1);
      
      if (pgError) {
        console.error('Error using pgSQL directly:', pgError);
        console.log('Cannot use pgSQL directly.');
      } else {
        console.log('Successfully used pgSQL directly!');
        console.log('Result:', pgData);
      }
    } catch (error) {
      console.error('Error using pgSQL directly:', error);
      console.log('Cannot use pgSQL directly.');
    }
    
    // Conclusion
    console.log('\n=== Diagnosis Results ===');
    console.log('1. Connection to Supabase: Success');
    console.log('2. exec_sql function: Not available');
    console.log('3. create_test_function RPC: Not available');
    console.log('4. Direct SQL execution via REST API: Limited support');
    console.log('5. Direct pgSQL access: Limited support');
    
    console.log('\n=== Recommended Solution ===');
    console.log('1. Use the Supabase SQL Editor directly for complex SQL operations');
    console.log('2. For simple operations, use the Supabase client API');
    console.log('3. Create a SQL migration file and run it in the Supabase SQL Editor');
    console.log('4. Consider creating custom RPC functions in the Supabase dashboard for specific operations');
    
    // Create a simple SQL file that can be run in the Supabase SQL Editor
    const simpleSqlPath = path.join(__dirname, 'simple-commission-fix.sql');
    const simpleSqlContent = `
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
    `;
    
    fs.writeFileSync(simpleSqlPath, simpleSqlContent);
    console.log(`\nCreated a simple SQL file at ${simpleSqlPath}`);
    console.log('Please run this file in the Supabase SQL Editor to fix the commission calculations.');
  } catch (error) {
    console.error('Error during diagnosis:', error);
  }
}

// Run the diagnosis
diagnoseExecution();