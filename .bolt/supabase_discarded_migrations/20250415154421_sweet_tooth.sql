/*
  # Initial Schema Setup for MyAgentView CRM

  1. Tables Created
    - roles (user roles)
    - permissions (system permissions)
    - role_permissions (role-permission assignments)
    - positions (agent hierarchy levels)
    - users (agents and staff)
    - user_roles (user-role assignments)
    - carriers (insurance companies)
    - products (insurance products)
    - commission_splits (commission structure)
    - deals (insurance policies)
    - commissions (earned commissions)
    - settings (system configuration)
    - integrations (third-party integrations)
    - daily_sales_counters (daily sales tracking)

  2. Functions and Triggers
    - Commission calculation trigger
    - Updated timestamp triggers
*/

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS after_deal_insert ON deals;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_carriers_updated_at ON carriers;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_commission_splits_updated_at ON commission_splits;
DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
DROP TRIGGER IF EXISTS update_commissions_updated_at ON commissions;
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
DROP TRIGGER IF EXISTS update_integrations_updated_at ON integrations;
DROP TRIGGER IF EXISTS update_daily_sales_counters_updated_at ON daily_sales_counters;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS calculate_commissions();
DROP FUNCTION IF EXISTS update_updated_at();

-- Create roles table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create permissions table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resource, action)
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create role_permissions table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id UUID REFERENCES roles NOT NULL,
    permission_id UUID REFERENCES permissions NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create positions table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create users table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    position_id UUID REFERENCES positions,
    upline_id UUID REFERENCES users,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create user_roles table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users NOT NULL,
    role_id UUID REFERENCES roles NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id)
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create carriers table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS carriers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    advance_rate DECIMAL(5,2) NOT NULL,
    logo_url TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create products table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    carrier_id UUID REFERENCES carriers NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(carrier_id, name)
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create commission_splits table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS commission_splits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    position_id UUID REFERENCES positions NOT NULL,
    product_id UUID REFERENCES products NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(position_id, product_id)
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create deals table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES users NOT NULL,
    carrier_id UUID REFERENCES carriers NOT NULL,
    product_id UUID REFERENCES products NOT NULL,
    client_name TEXT NOT NULL,
    client_dob DATE,
    client_phone TEXT,
    client_email TEXT,
    face_amount DECIMAL(12,2),
    monthly_premium DECIMAL(10,2) NOT NULL,
    annual_premium DECIMAL(10,2) NOT NULL,
    policy_number TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create commissions table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id UUID REFERENCES deals NOT NULL,
    user_id UUID REFERENCES users NOT NULL,
    position_id UUID REFERENCES positions NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create settings table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create integrations table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create daily_sales_counters table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS daily_sales_counters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES users NOT NULL,
    date DATE NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, date)
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create commission calculation function
CREATE OR REPLACE FUNCTION calculate_commissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the agent's position
  DECLARE agent_position_id UUID;
  SELECT position_id INTO agent_position_id FROM users WHERE id = NEW.agent_id;
  
  -- Get the agent's upline chain
  WITH RECURSIVE upline_chain AS (
    SELECT id, upline_id, position_id FROM users WHERE id = NEW.agent_id
    UNION
    SELECT u.id, u.upline_id, u.position_id
    FROM users u
    JOIN upline_chain uc ON u.id = uc.upline_id
  )
  
  -- Calculate commissions for each person in the upline chain
  INSERT INTO commissions (deal_id, user_id, position_id, amount, percentage)
  SELECT 
    NEW.id,
    uc.id,
    uc.position_id,
    (NEW.annual_premium * cs.percentage / 100),
    cs.percentage
  FROM upline_chain uc
  JOIN commission_splits cs ON uc.position_id = cs.position_id
  WHERE cs.product_id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for commission calculation
CREATE TRIGGER after_deal_insert
AFTER INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION calculate_commissions();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_carriers_updated_at
  BEFORE UPDATE ON carriers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_commission_splits_updated_at
  BEFORE UPDATE ON commission_splits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_daily_sales_counters_updated_at
  BEFORE UPDATE ON daily_sales_counters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();