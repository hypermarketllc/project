/*
  # Add foreign key relationship between users and positions tables

  1. Changes
    - Add foreign key constraint from users.position_id to positions.id
    - Add index on users.position_id for better query performance

  2. Security
    - No security changes required as RLS is handled separately
*/

-- Add foreign key constraint
ALTER TABLE users
ADD CONSTRAINT users_position_id_fkey
FOREIGN KEY (position_id) REFERENCES positions(id);

-- Add index for better join performance
CREATE INDEX IF NOT EXISTS idx_users_position_id 
ON users(position_id);