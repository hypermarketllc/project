/*
  # Create user accounts table

  1. New Tables
    - `user_accs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `display_name` (text)
      - `avatar_url` (text, nullable)
      - `theme_preference` (text, default 'light')
      - `notification_preferences` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for users to manage their own data
*/

-- Create the user accounts table
CREATE TABLE IF NOT EXISTS user_accs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  theme_preference text DEFAULT 'light',
  notification_preferences jsonb DEFAULT '{
    "email": true,
    "push": true,
    "deals": true,
    "system": true
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_accs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own account"
  ON user_accs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own account"
  ON user_accs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own account"
  ON user_accs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_accs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_accs_updated_at
  BEFORE UPDATE ON user_accs
  FOR EACH ROW
  EXECUTE FUNCTION update_user_accs_updated_at();