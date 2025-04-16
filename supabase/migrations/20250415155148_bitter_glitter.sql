/*
  # Complete Database Schema Setup

  1. Tables
    - carriers (insurance companies)
    - products (insurance products)
    - positions (agent hierarchy levels)
    - users (agents and managers)
    - commission_splits (commission percentages by position)
    - deals (insurance policies sold)
    - commissions (calculated commissions)
    - settings (system configuration)

  2. Sample Data
    - Default carriers and products
    - Position hierarchy
    - Commission split configurations
    - System settings
*/

-- Create carriers table
CREATE TABLE IF NOT EXISTS carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid NOT NULL REFERENCES carriers(id),
  name text NOT NULL
);

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  level integer NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  position_id uuid REFERENCES positions(id),
  upline_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create commission_splits table
CREATE TABLE IF NOT EXISTS commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id),
  product_id uuid NOT NULL REFERENCES products(id),
  percentage numeric(5,2) NOT NULL,
  UNIQUE(position_id, product_id)
);

-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES users(id),
  carrier_id uuid NOT NULL REFERENCES carriers(id),
  product_id uuid NOT NULL REFERENCES products(id),
  client_name text NOT NULL,
  annual_premium numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create commissions table
CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id),
  user_id uuid NOT NULL REFERENCES users(id),
  position_id uuid NOT NULL REFERENCES positions(id),
  amount numeric(10,2) NOT NULL,
  percentage numeric(5,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert sample carriers
INSERT INTO carriers (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Prudential'),
  ('22222222-2222-2222-2222-222222222222', 'MetLife'),
  ('33333333-3333-3333-3333-333333333333', 'AIG')
ON CONFLICT (name) DO NOTHING;

-- Insert sample products
INSERT INTO products (carrier_id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Term Life 20'),
  ('11111111-1111-1111-1111-111111111111', 'Whole Life'),
  ('22222222-2222-2222-2222-222222222222', 'Universal Life'),
  ('33333333-3333-3333-3333-333333333333', 'Variable Life')
ON CONFLICT DO NOTHING;

-- Insert positions
INSERT INTO positions (name, level, description) VALUES
  ('Agent', 1, 'Entry level sales agent'),
  ('Senior Agent', 2, 'Experienced sales agent'),
  ('District Manager', 3, 'Manages a team of agents'),
  ('Regional Manager', 4, 'Oversees multiple districts')
ON CONFLICT (name) DO NOTHING;

-- Insert commission splits
INSERT INTO commission_splits (position_id, product_id, percentage)
SELECT 
  p.id as position_id,
  pr.id as product_id,
  CASE 
    WHEN p.level = 1 THEN 50
    WHEN p.level = 2 THEN 60
    WHEN p.level = 3 THEN 70
    WHEN p.level = 4 THEN 80
  END as percentage
FROM positions p
CROSS JOIN products pr
ON CONFLICT (position_id, product_id) DO NOTHING;

-- Insert settings
INSERT INTO settings (key, value, description) VALUES
  ('commission_rates', '{"default": 10, "senior": 15, "manager": 20}', 'Default commission rates by position level'),
  ('payout_schedule', '{"frequency": "monthly", "day": 15}', 'Commission payout schedule configuration'),
  ('minimum_deal_amount', '100', 'Minimum deal amount required for commission calculation'),
  ('override_levels', '3', 'Number of levels up for override commissions'),
  ('system_currency', '"USD"', 'Default system currency'),
  ('tax_rate', '0.30', 'Default tax rate for commission calculations')
ON CONFLICT (key) DO NOTHING;

-- Create function to calculate commissions
CREATE OR REPLACE FUNCTION calculate_commissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert commission record for the agent
  INSERT INTO commissions (deal_id, user_id, position_id, amount, percentage)
  SELECT 
    NEW.id as deal_id,
    NEW.agent_id as user_id,
    u.position_id,
    NEW.annual_premium * (cs.percentage / 100) as amount,
    cs.percentage
  FROM users u
  JOIN commission_splits cs ON cs.position_id = u.position_id
  WHERE u.id = NEW.agent_id
  AND cs.product_id = NEW.product_id;

  -- Insert commission records for upline (override commissions)
  WITH RECURSIVE upline AS (
    -- Base case: direct upline
    SELECT 
      u.id,
      u.upline_id,
      u.position_id,
      1 as level
    FROM users u
    WHERE u.id = NEW.agent_id
    
    UNION ALL
    
    -- Recursive case: upline's upline
    SELECT 
      u.id,
      u.upline_id,
      u.position_id,
      ul.level + 1
    FROM users u
    JOIN upline ul ON u.id = ul.upline_id
    WHERE ul.level < (
      SELECT CAST(value::json->>'override_levels' AS INTEGER)
      FROM settings
      WHERE key = 'override_levels'
    )
  )
  INSERT INTO commissions (deal_id, user_id, position_id, amount, percentage)
  SELECT 
    NEW.id as deal_id,
    u.upline_id as user_id,
    p.position_id,
    NEW.annual_premium * (cs.percentage / 100) * (0.5 ^ u.level) as amount,
    cs.percentage * (0.5 ^ u.level) as percentage
  FROM upline u
  JOIN users p ON p.id = u.upline_id
  JOIN commission_splits cs ON cs.position_id = p.position_id
  WHERE u.upline_id IS NOT NULL
  AND cs.product_id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;