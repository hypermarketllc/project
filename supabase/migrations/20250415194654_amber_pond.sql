/*
  # Add RLS policies for carriers table

  1. Security Changes
    - Add RLS policy for inserting carriers
    - Add RLS policy for updating carriers
    - Add RLS policy for deleting carriers

  These policies will allow:
    - Authenticated users with position level >= 4 (admins) to insert, update, and delete carriers
*/

-- Policy for inserting carriers
CREATE POLICY "Admins can insert carriers"
ON carriers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.position_id IN (
      SELECT positions.id
      FROM positions
      WHERE positions.level >= 4
    )
  )
);

-- Policy for updating carriers
CREATE POLICY "Admins can update carriers"
ON carriers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.position_id IN (
      SELECT positions.id
      FROM positions
      WHERE positions.level >= 4
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.position_id IN (
      SELECT positions.id
      FROM positions
      WHERE positions.level >= 4
    )
  )
);

-- Policy for deleting carriers
CREATE POLICY "Admins can delete carriers"
ON carriers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.position_id IN (
      SELECT positions.id
      FROM positions
      WHERE positions.level >= 4
    )
  )
);