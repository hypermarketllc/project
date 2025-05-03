/*
  # Fix user email constraints and policies

  1. Changes
    - Remove unique constraint on users.email
    - Update RLS policies to handle non-unique emails
    - Add index for email lookups
    - Update triggers for proper timestamp handling

  2. Security
    - Maintain RLS policies for user data protection
    - Users can only access their own data
*/

-- Drop existing constraints and indexes
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
DROP INDEX IF EXISTS users_email_key;
DROP INDEX IF EXISTS idx_users_email;

-- Create new non-unique index for performance
CREATE INDEX idx_users_email ON users (email);

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create updated RLS policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure updated_at is properly maintained
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();