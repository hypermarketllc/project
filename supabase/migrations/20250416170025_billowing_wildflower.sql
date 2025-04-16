/*
  # Fix ambiguous column reference in get_position_permissions function
  
  1. Changes
    - Update get_position_permissions function to properly qualify the section column
    - Add explicit table alias to avoid ambiguity
    - Improve readability with better formatting
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_position_permissions;

-- Create updated function with fixed column references
CREATE OR REPLACE FUNCTION get_position_permissions(p_position_id uuid)
RETURNS TABLE (
  section text,
  can_view boolean,
  can_edit boolean,
  can_delete boolean
) AS $$
BEGIN
  -- If owner position, return full access to all sections
  IF EXISTS (
    SELECT 1 FROM positions 
    WHERE id = p_position_id AND level = 5
  ) THEN
    RETURN QUERY
    SELECT 
      s.section_name as section,
      true as can_view,
      true as can_edit,
      true as can_delete
    FROM (
      SELECT unnest(ARRAY[
        'dashboard',
        'post-deal',
        'agents',
        'book',
        'configuration',
        'monitoring',
        'settings'
      ]) as section_name
    ) s;
  ELSE
    -- Return actual permissions with explicit table alias
    RETURN QUERY
    SELECT 
      pp.section,
      pp.can_view,
      pp.can_edit,
      pp.can_delete
    FROM position_permissions pp
    WHERE pp.position_id = p_position_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the function
COMMENT ON FUNCTION get_position_permissions IS 'Returns all permissions for a given position, with full access for owner position';