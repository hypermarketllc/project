/*
  # Remove RLS from all tables
  
  1. Changes
    - Disable RLS on all tables
    - Drop all existing policies
*/

-- Disable RLS on all tables
ALTER TABLE carriers DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits DISABLE ROW LEVEL SECURITY;
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE commissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_checks DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to read positions" ON positions;
DROP POLICY IF EXISTS "Allow authenticated users to read carriers" ON carriers;
DROP POLICY IF EXISTS "Allow authenticated users to read products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users to read commission splits" ON commission_splits;
DROP POLICY IF EXISTS "Users can read own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert own deals" ON deals;
DROP POLICY IF EXISTS "Users can delete own pending deals" ON deals;
DROP POLICY IF EXISTS "Users can read own commissions" ON commissions;
DROP POLICY IF EXISTS "System can insert commissions" ON commissions;
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON settings;
DROP POLICY IF EXISTS "Admins can update settings" ON settings;
DROP POLICY IF EXISTS "Allow authenticated users to read integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can manage integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can insert carriers" ON carriers;
DROP POLICY IF EXISTS "Admins can update carriers" ON carriers;
DROP POLICY IF EXISTS "Admins can delete carriers" ON carriers;
DROP POLICY IF EXISTS "Admins can delete products" ON products;