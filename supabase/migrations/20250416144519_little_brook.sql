/*
  # Add Role-Based Permissions
  
  1. Changes
    - Add functions to check user permissions
    - Add policies for different access levels
    - Set up view restrictions based on position level
*/

-- Create function to check user's position level
CREATE OR REPLACE FUNCTION get_user_position_level(user_id uuid)
RETURNS integer AS $$
DECLARE
  position_level integer;
BEGIN
  SELECT p.level INTO position_level
  FROM users u
  JOIN positions p ON u.position_id = p.id
  WHERE u.id = user_id;
  
  RETURN COALESCE(position_level, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can view all deals
CREATE OR REPLACE FUNCTION can_view_all_deals(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN get_user_position_level(user_id) >= 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can manage users
CREATE OR REPLACE FUNCTION can_manage_users(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN get_user_position_level(user_id) >= 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can access configuration
CREATE OR REPLACE FUNCTION can_access_configuration(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN get_user_position_level(user_id) >= 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's downline
CREATE OR REPLACE FUNCTION get_user_downline(user_id uuid)
RETURNS TABLE (subordinate_id uuid) AS $$
WITH RECURSIVE downline AS (
  -- Base case: direct reports
  SELECT id, upline_id
  FROM users
  WHERE upline_id = user_id
  
  UNION ALL
  
  -- Recursive case: reports of reports
  SELECT u.id, u.upline_id
  FROM users u
  INNER JOIN downline d ON u.upline_id = d.subordinate_id
)
SELECT subordinate_id FROM downline;
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies for deals table
DROP POLICY IF EXISTS "Users can view own and downline deals" ON deals;
CREATE POLICY "Users can view own and downline deals"
ON deals
FOR SELECT
TO authenticated
USING (
  agent_id = auth.uid()
  OR (
    can_view_all_deals(auth.uid())
    OR agent_id IN (SELECT subordinate_id FROM get_user_downline(auth.uid()))
  )
);

-- Policies for users table
DROP POLICY IF EXISTS "Users can view and edit own profile" ON users;
CREATE POLICY "Users can view and edit own profile"
ON users
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all users" ON users;
CREATE POLICY "Admins can manage all users"
ON users
FOR ALL
TO authenticated
USING (can_manage_users(auth.uid()))
WITH CHECK (can_manage_users(auth.uid()));

-- Policies for carriers table
DROP POLICY IF EXISTS "Admins can manage carriers" ON carriers;
CREATE POLICY "Admins can manage carriers"
ON carriers
FOR ALL
TO authenticated
USING (can_access_configuration(auth.uid()))
WITH CHECK (can_access_configuration(auth.uid()));

DROP POLICY IF EXISTS "Users can view carriers" ON carriers;
CREATE POLICY "Users can view carriers"
ON carriers
FOR SELECT
TO authenticated
USING (true);

-- Policies for products table
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products"
ON products
FOR ALL
TO authenticated
USING (can_access_configuration(auth.uid()))
WITH CHECK (can_access_configuration(auth.uid()));

DROP POLICY IF EXISTS "Users can view products" ON products;
CREATE POLICY "Users can view products"
ON products
FOR SELECT
TO authenticated
USING (true);

-- Policies for positions table
DROP POLICY IF EXISTS "Admins can manage positions" ON positions;
CREATE POLICY "Admins can manage positions"
ON positions
FOR ALL
TO authenticated
USING (can_access_configuration(auth.uid()))
WITH CHECK (can_access_configuration(auth.uid()));

DROP POLICY IF EXISTS "Users can view positions" ON positions;
CREATE POLICY "Users can view positions"
ON positions
FOR SELECT
TO authenticated
USING (true);

-- Policies for commission_splits table
DROP POLICY IF EXISTS "Admins can manage commission splits" ON commission_splits;
CREATE POLICY "Admins can manage commission splits"
ON commission_splits
FOR ALL
TO authenticated
USING (can_access_configuration(auth.uid()))
WITH CHECK (can_access_configuration(auth.uid()));

DROP POLICY IF EXISTS "Users can view commission splits" ON commission_splits;
CREATE POLICY "Users can view commission splits"
ON commission_splits
FOR SELECT
TO authenticated
USING (true);

-- Policies for settings table
DROP POLICY IF EXISTS "Admins can manage settings" ON settings;
CREATE POLICY "Admins can manage settings"
ON settings
FOR ALL
TO authenticated
USING (can_access_configuration(auth.uid()))
WITH CHECK (can_access_configuration(auth.uid()));

DROP POLICY IF EXISTS "Users can view settings" ON settings;
CREATE POLICY "Users can view settings"
ON settings
FOR SELECT
TO authenticated
USING (true);

-- Enable RLS on all tables
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Ensure admin user has owner position
UPDATE users
SET position_id = (SELECT id FROM positions WHERE name = 'owner')
WHERE email = 'admin@americancoveragecenter.com';