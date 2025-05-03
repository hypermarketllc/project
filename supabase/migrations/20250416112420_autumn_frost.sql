/*
  # Add upline relationship to users table

  1. Changes
    - Add foreign key constraint for upline_id in users table
    - This establishes the self-referential relationship needed for the upline hierarchy

  2. Security
    - No RLS changes needed as this is a structural change
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_upline_id_fkey'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_upline_id_fkey
    FOREIGN KEY (upline_id) REFERENCES users(id);
  END IF;
END $$;