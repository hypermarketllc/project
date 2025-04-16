/*
  # Create integrations table

  1. New Tables
    - `integrations`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `type` (text, not null)
      - `config` (jsonb, not null)
      - `is_active` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `integrations` table
    - Add policy for authenticated users to read integrations
    - Add policy for admins to manage integrations
*/

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read integrations"
  ON integrations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage integrations"
  ON integrations
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.position_id IN (
        SELECT id FROM positions WHERE level >= 4
      )
    )
  );