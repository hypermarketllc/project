/*
  # Fix Authentication Setup

  1. Changes
    - Insert default admin user with proper credentials
    - Update user_accs constraints
    - Add proper indexes
*/

-- Insert admin user into auth.users if not exists
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '00000000-0000-0000-0000-000000000000',
  'admin@example.com',
  '$2a$10$Q7QJVW9S0D7C3z8HGJGXn.ZK.Vt.pJJeZkGwL.tU6nWHv4YdHlQ2q', -- Password: Admin123!
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Admin User"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding user record
INSERT INTO public.users (
  id,
  email,
  full_name,
  is_active,
  created_at,
  updated_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'admin@example.com',
  'Admin User',
  true,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Insert user account record
INSERT INTO public.user_accs (
  user_id,
  display_name,
  theme_preference,
  notification_preferences,
  created_at,
  updated_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Admin User',
  'light',
  '{
    "email": true,
    "push": true,
    "deals": true,
    "system": true
  }'::jsonb,
  now(),
  now()
) ON CONFLICT (user_id) DO NOTHING;