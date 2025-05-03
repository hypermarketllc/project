/*
  # Add cascade delete for carrier products

  1. Changes
    - Drop existing foreign key constraint on products table
    - Add new foreign key constraint with ON DELETE CASCADE
    - Add RLS policies for products table
*/

-- First drop the existing foreign key constraint
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_carrier_id_fkey;

-- Add new foreign key constraint with cascade delete
ALTER TABLE products
ADD CONSTRAINT products_carrier_id_fkey
FOREIGN KEY (carrier_id)
REFERENCES carriers(id)
ON DELETE CASCADE;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

-- Create new policies
CREATE POLICY "Allow authenticated users to read products"
ON products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can delete products"
ON products FOR DELETE
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