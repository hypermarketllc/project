-- Grant privileges to the crm_user
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_user;

-- Connect to the crm_db database
\c crm_db

-- Grant privileges on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crm_user;

-- Grant privileges on all sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crm_user;

-- Grant privileges on all functions
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO crm_user;

-- Create missing extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a test user for login
INSERT INTO users (id, email, password, full_name, position_id)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'admin@example.com',
  '$2a$10$JqmNvHv7VcU1nP0Oc0YVN.zUmA5TJi.ZM53pzCGw6u7qWoYFHOEGi',  -- password: admin123
  'Admin User',
  (SELECT id FROM positions WHERE name = 'Owner' LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;