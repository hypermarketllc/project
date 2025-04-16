-- Remove RLS from permission_levels table
ALTER TABLE permission_levels DISABLE ROW LEVEL SECURITY;

-- Drop the policy from permission_levels
DROP POLICY IF EXISTS "Anyone can read permission levels" ON permission_levels;

-- Remove any other RLS policies that might exist
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can read all data" ON users;
DROP POLICY IF EXISTS "Admins can update all data" ON users;

-- Disable RLS on all tables that might have it enabled
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE commissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE carriers DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits DISABLE ROW LEVEL SECURITY;
ALTER TABLE integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_checks DISABLE ROW LEVEL SECURITY;