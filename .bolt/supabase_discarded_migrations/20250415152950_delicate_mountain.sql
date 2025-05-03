/*
  # Initial Database Schema Setup

  1. Tables Created
    - positions (hierarchy levels)
    - users (agents and managers)
    - carriers (insurance companies)
    - products (insurance products)
    - commission_splits (commission structure)
    - deals (insurance policies)
    - commissions (earned commissions)
    - daily_sales_counters (daily sales tracking)
    - settings (system configuration)
    - integrations (third-party integrations)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Indexes
    - Created for optimal query performance
    - Foreign key relationships
    - Commonly queried fields
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  level integer NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  position_id uuid REFERENCES positions(id),
  upline_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  avatar_url text,
  is_active boolean DEFAULT true
);

-- Create carriers table
CREATE TABLE IF NOT EXISTS carriers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  advance_rate numeric(5,2) NOT NULL,
  logo_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id uuid REFERENCES carriers(id) NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create commission_splits table
CREATE TABLE IF NOT EXISTS commission_splits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id uuid REFERENCES positions(id) NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  percentage numeric(5,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(position_id, product_id)
);

-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id uuid REFERENCES users(id) NOT NULL,
  carrier_id uuid REFERENCES carriers(id) NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  client_name text NOT NULL,
  client_dob date,
  client_phone text,
  client_email text,
  face_amount numeric(15,2),
  monthly_premium numeric(10,2) NOT NULL,
  annual_premium numeric(10,2) NOT NULL,
  policy_number text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create commissions table
CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid REFERENCES deals(id) NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL,
  position_id uuid REFERENCES positions(id) NOT NULL,
  amount numeric(10,2) NOT NULL,
  percentage numeric(5,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create daily_sales_counters table
CREATE TABLE IF NOT EXISTS daily_sales_counters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id uuid REFERENCES users(id) NOT NULL,
  date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, date)
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  type text NOT NULL,
  config jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_position_id ON users(position_id);
CREATE INDEX IF NOT EXISTS idx_users_upline_id ON users(upline_id);
CREATE INDEX IF NOT EXISTS idx_products_carrier_id ON products(carrier_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_position_product ON commission_splits(position_id, product_id);
CREATE INDEX IF NOT EXISTS idx_deals_agent_id ON deals(agent_id);
CREATE INDEX IF NOT EXISTS idx_deals_carrier_id ON deals(carrier_id);
CREATE INDEX IF NOT EXISTS idx_deals_product_id ON deals(product_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_commissions_deal_id ON commissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_counters_agent_date ON daily_sales_counters(agent_id, date);

-- Add RLS Policies
CREATE POLICY "Users can read all positions"
  ON positions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read all carriers"
  ON carriers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read all products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read commission splits"
  ON commission_splits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read their deals"
  ON deals FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid() OR 
         EXISTS (
           WITH RECURSIVE subordinates AS (
             SELECT id FROM users WHERE upline_id = auth.uid()
             UNION
             SELECT u.id FROM users u
             INNER JOIN subordinates s ON u.upline_id = s.id
           )
           SELECT 1 FROM subordinates WHERE id = agent_id
         ));

CREATE POLICY "Users can create their own deals"
  ON deals FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Users can read their commissions"
  ON commissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insert initial data
INSERT INTO positions (name, level, description) VALUES
  ('Agency Owner', 1, 'Top level position'),
  ('Regional Manager', 2, 'Mid level position'),
  ('Agent', 3, 'Entry level position');

INSERT INTO carriers (name, advance_rate, contact_name, contact_email) VALUES
  ('ABC Insurance', 75.00, 'Sarah Smith', 'sarah@abcins.com'),
  ('XYZ Life', 80.00, 'Mike Johnson', 'mike@xyzlife.com');

-- Insert settings
INSERT INTO settings (key, value, description) VALUES
  ('commission_payout_day', '"15"', 'Day of month when commissions are paid'),
  ('minimum_face_amount', '25000', 'Minimum face amount for life insurance policies'),
  ('system_theme', '{"primary": "#4338CA", "secondary": "#0F766E"}', 'System theme colors'),
  ('default_commission_status', '"pending"', 'Default status for new commissions'),
  ('notification_preferences', '{"email": true, "sms": false, "push": true}', 'User notification preferences');