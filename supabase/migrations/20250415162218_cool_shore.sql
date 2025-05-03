/*
  # Add System Logging and Status Tables

  1. New Tables
    - `system_logs`
      - `id` (uuid, primary key)
      - `level` (text, enum: info, warning, error)
      - `message` (text)
      - `metadata` (jsonb, optional)
      - `created_at` (timestamp)
    
    - `system_status`
      - `id` (uuid, primary key)
      - `name` (text)
      - `status` (text, enum: operational, degraded, down)
      - `last_check` (timestamp)
      - `details` (jsonb, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
*/

-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create system_status table
CREATE TABLE IF NOT EXISTS system_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('operational', 'degraded', 'down')),
  last_check timestamptz NOT NULL DEFAULT now(),
  details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert initial status records
INSERT INTO system_status (name, status) VALUES
  ('Database', 'operational'),
  ('API Server', 'operational'),
  ('Authentication Service', 'operational'),
  ('File Storage', 'operational'),
  ('Email Service', 'operational'),
  ('Background Jobs', 'operational');