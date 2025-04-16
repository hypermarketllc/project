-- First, clean up any duplicate users
DELETE FROM users a USING users b
WHERE a.id > b.id 
AND a.email = b.email;

-- Add unique constraint on email
ALTER TABLE users
ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_position_id ON users(position_id);
CREATE INDEX IF NOT EXISTS idx_users_upline_id ON users(upline_id);
CREATE INDEX IF NOT EXISTS idx_users_permission_level_id ON users(permission_level_id);

-- Create function to update user details
CREATE OR REPLACE FUNCTION update_user_details(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_position_id uuid,
  p_upline_id uuid,
  p_national_producer_number text,
  p_annual_goal numeric,
  p_is_active boolean
)
RETURNS void AS $$
BEGIN
  -- Check if user has permission to update
  IF NOT (
    -- Allow users to update their own basic details
    auth.uid() = p_user_id 
    OR 
    -- Or if they have admin/owner privileges
    EXISTS (
      SELECT 1 
      FROM users u 
      JOIN positions p ON u.position_id = p.id 
      WHERE u.id = auth.uid() AND p.level >= 4
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to update user details';
  END IF;

  -- Update user details
  UPDATE users
  SET 
    full_name = COALESCE(p_full_name, full_name),
    email = COALESCE(p_email, email),
    phone = COALESCE(p_phone, phone),
    position_id = COALESCE(p_position_id, position_id),
    upline_id = p_upline_id,
    national_producer_number = COALESCE(p_national_producer_number, national_producer_number),
    annual_goal = COALESCE(p_annual_goal, annual_goal),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's position level
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

-- Create function to check if user can manage users
CREATE OR REPLACE FUNCTION can_manage_users(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN get_user_position_level(user_id) >= 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's downline
CREATE OR REPLACE FUNCTION get_user_downline(user_id uuid)
RETURNS TABLE (id uuid) AS $$
WITH RECURSIVE downline AS (
  -- Base case: direct reports
  SELECT u.id, u.upline_id
  FROM users u
  WHERE u.upline_id = user_id
  
  UNION ALL
  
  -- Recursive case: reports of reports
  SELECT u.id, u.upline_id
  FROM users u
  INNER JOIN downline d ON u.upline_id = d.id
)
SELECT id FROM downline;
$$ LANGUAGE sql SECURITY DEFINER;

-- Update the admin user to have owner position
UPDATE users
SET 
  position_id = (SELECT id FROM positions WHERE name = 'owner'),
  is_active = true
WHERE email = 'admin@americancoveragecenter.com';

-- Ensure all users have a position
UPDATE users u
SET position_id = (
  SELECT id FROM positions WHERE name = 'agent'
)
WHERE position_id IS NULL;

-- Clean up any invalid upline references
UPDATE users
SET upline_id = NULL
WHERE upline_id NOT IN (SELECT id FROM users);