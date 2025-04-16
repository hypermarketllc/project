-- Create function to delete user and associated data
CREATE OR REPLACE FUNCTION delete_user_cascade(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Check if user has permission to delete
  IF NOT (
    auth.uid() = target_user_id OR
    EXISTS (
      SELECT 1 
      FROM users u 
      JOIN positions p ON u.position_id = p.id 
      WHERE u.id = auth.uid() AND p.level >= 4
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to delete user';
  END IF;

  -- Delete associated commissions
  DELETE FROM commissions WHERE user_id = target_user_id;
  
  -- Delete associated deals
  DELETE FROM deals WHERE agent_id = target_user_id;
  
  -- Update users who had this user as upline
  UPDATE users 
  SET upline_id = NULL,
      updated_at = now()
  WHERE upline_id = target_user_id;
  
  -- Delete user account
  DELETE FROM user_accs WHERE user_id = target_user_id;
  
  -- Delete user record
  DELETE FROM users WHERE id = target_user_id;
  
  -- Delete auth user
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_user_cascade IS 'Deletes a user and all associated data. Requires admin access or self-deletion.';