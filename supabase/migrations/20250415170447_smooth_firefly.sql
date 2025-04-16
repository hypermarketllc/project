/*
  # Add system health check table and function

  1. New Tables
    - system_health_checks: Table for testing system operations
  
  2. New Functions
    - check_create_table_permission: Function to test table creation permissions
*/

-- Create a table for system health checks
CREATE TABLE IF NOT EXISTS system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create a function to test table creation permissions
CREATE OR REPLACE FUNCTION check_create_table_permission()
RETURNS void AS $$
BEGIN
  -- Attempt to create a temporary table
  CREATE TEMPORARY TABLE IF NOT EXISTS _temp_test_table (
    id serial PRIMARY KEY,
    test_column text
  );
  
  -- Drop the temporary table
  DROP TABLE IF EXISTS _temp_test_table;
END;
$$ LANGUAGE plpgsql;