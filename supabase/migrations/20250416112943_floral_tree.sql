-- Drop and recreate the users table to ensure clean state
DROP TABLE IF EXISTS users CASCADE;

-- Create users table with all required fields
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  position_id uuid REFERENCES positions(id),
  upline_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  national_producer_number text,
  annual_goal numeric(10,2),
  permission_level_id uuid REFERENCES permission_levels(id),
  phone text,
  is_active boolean DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_position_id ON users(position_id);
CREATE INDEX IF NOT EXISTS idx_users_upline_id ON users(upline_id);
CREATE INDEX IF NOT EXISTS idx_users_permission_level_id ON users(permission_level_id);

-- Insert sample data
INSERT INTO users (email, full_name, position_id, national_producer_number, annual_goal, phone, is_active)
VALUES 
  ('john.doe@example.com', 'John Doe', (SELECT id FROM positions WHERE name = 'Senior Agent' LIMIT 1), 'NPN123456', 100000.00, '(555) 123-4567', true),
  ('jane.smith@example.com', 'Jane Smith', (SELECT id FROM positions WHERE name = 'Agent' LIMIT 1), 'NPN789012', 75000.00, '(555) 234-5678', true),
  ('bob.wilson@example.com', 'Bob Wilson', (SELECT id FROM positions WHERE name = 'Team Lead' LIMIT 1), 'NPN345678', 150000.00, '(555) 345-6789', true);

-- Update upline relationships
UPDATE users 
SET upline_id = (SELECT id FROM users WHERE email = 'bob.wilson@example.com')
WHERE email IN ('john.doe@example.com', 'jane.smith@example.com');