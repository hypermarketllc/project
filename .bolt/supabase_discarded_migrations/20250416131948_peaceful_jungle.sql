/*
  # Create user accounts table

  1. New Tables
    - `user_accounts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users.id)
      - `username` (text, unique)
      - `password_hash` (text)
      - `last_login` (timestamptz)
      - `failed_login_attempts` (integer)
      - `locked_until` (timestamptz)
      - `must_change_password` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_accounts` table
    - Add policy for users to read their own account data
    - Add policy for users to update their own account data

  3. Triggers
    - Add trigger to update updated_at timestamp
*/

-- Create user accounts table
CREATE TABLE IF NOT EXISTS user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  last_login timestamptz,
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  must_change_password boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_accounts_user_id ON user_accounts(user_id);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_accounts_username ON user_accounts(username);

-- Create updated_at trigger function if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  END IF;
END $$;

-- Create trigger for updating updated_at
CREATE TRIGGER update_user_accounts_updated_at
  BEFORE UPDATE ON user_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own account data"
  ON user_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own account data"
  ON user_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE user_accounts IS 'Stores user account information and credentials';
COMMENT ON COLUMN user_accounts.user_id IS 'References the main users table';
COMMENT ON COLUMN user_accounts.username IS 'Unique username for login';
COMMENT ON COLUMN user_accounts.password_hash IS 'Hashed password';
COMMENT ON COLUMN user_accounts.last_login IS 'Timestamp of last successful login';
COMMENT ON COLUMN user_accounts.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN user_accounts.locked_until IS 'Account is locked until this timestamp';
COMMENT ON COLUMN user_accounts.must_change_password IS 'User must change password on next login';