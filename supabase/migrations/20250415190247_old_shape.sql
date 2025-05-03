/*
  # Fix System Monitoring

  1. Changes
    - Grant necessary permissions to the anon role
    - Grant execute permission on check_create_table_permission function
    - Grant CRUD permissions on system_health_checks table
*/

-- Grant necessary permissions to the anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT EXECUTE ON FUNCTION check_create_table_permission TO anon;
GRANT ALL ON TABLE system_health_checks TO anon;

-- Ensure the function is created with proper security context
ALTER FUNCTION check_create_table_permission() SECURITY DEFINER;

-- Add comment to the function
COMMENT ON FUNCTION check_create_table_permission IS 'Tests if the current user has permission to create tables';

-- Add comment to the system_health_checks table
COMMENT ON TABLE system_health_checks IS 'Table used for system health monitoring';