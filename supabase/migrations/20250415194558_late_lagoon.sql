/*
  # Add advance rate to carriers

  1. Changes
    - Add `advance_rate` column to `carriers` table
      - Type: numeric(5,2) to store percentage values with 2 decimal places
      - Not nullable with default value of 0
      - Constraint to ensure value is between 0 and 100

  2. Notes
    - The advance_rate column represents the percentage of commission that is advanced to agents
    - Values are stored as decimals (e.g., 75.50 for 75.50%)
*/

ALTER TABLE carriers 
ADD COLUMN advance_rate numeric(5,2) NOT NULL DEFAULT 0
CHECK (advance_rate >= 0 AND advance_rate <= 100);

-- Update RLS policy to include the new column
DROP POLICY IF EXISTS "Allow authenticated users to read carriers" ON carriers;
CREATE POLICY "Allow authenticated users to read carriers"
ON carriers
FOR SELECT
TO authenticated
USING (true);