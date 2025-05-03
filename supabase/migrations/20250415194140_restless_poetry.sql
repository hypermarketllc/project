/*
  # Add Additional Security Policies
  
  1. Changes
    - Add insert policies for deals and commissions
    - Add update policies for users and settings
    - Add delete policies for deals
*/

-- Add insert policies
CREATE POLICY "Users can insert own deals"
  ON deals FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "System can insert commissions"
  ON commissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add update policies
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND position_id IN (
        SELECT id FROM positions
        WHERE level >= 4
      )
    )
  );

-- Add delete policy
CREATE POLICY "Users can delete own pending deals"
  ON deals FOR DELETE
  TO authenticated
  USING (
    agent_id = auth.uid()
    AND id NOT IN (
      SELECT deal_id FROM commissions
    )
  );

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deals_agent_id ON deals(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_position_id ON users(position_id);
CREATE INDEX IF NOT EXISTS idx_products_carrier_id ON products(carrier_id);