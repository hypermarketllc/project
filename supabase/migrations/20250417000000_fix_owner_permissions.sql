/*
  # Fix owner permissions for updating user positions
  
  1. Changes
    - Update the update_user_details function to specifically allow owner position (level 5) to update any user's details
    - Add special handling for position changes to ensure only owners can change positions
*/

-- Update the function to allow owners to update user positions
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
DECLARE
  v_current_user_level integer;
BEGIN
  -- Get the current user's position level
  SELECT p.level INTO v_current_user_level
  FROM users u
  JOIN positions p ON u.position_id = p.id
  WHERE u.id = auth.uid();
  
  -- Check if user has permission to update
  IF NOT (
    -- Allow users to update their own basic details (except position)
    (auth.uid() = p_user_id AND p_position_id IS NULL)
    OR 
    -- Or if they have admin privileges (level 4)
    v_current_user_level = 4
    OR
    -- Or if they have owner privileges (level 5)
    v_current_user_level = 5
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to update user details';
  END IF;
  
  -- Special check for position changes - only owner (level 5) can change positions
  IF p_position_id IS NOT NULL AND p_position_id != (SELECT position_id FROM users WHERE id = p_user_id) THEN
    IF v_current_user_level < 5 THEN
      RAISE EXCEPTION 'Only owner can change user positions';
    END IF;
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

-- Add comment to explain function usage
COMMENT ON FUNCTION update_user_details IS 'Updates user details with proper permission checks. Only owners can change user positions.';