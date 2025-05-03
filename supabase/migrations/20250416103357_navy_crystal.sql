/*
  # Update Integrations Schema
  
  1. Changes
    - Drop existing integrations table
    - Create new integrations table without RLS
*/

-- Drop existing integrations table if it exists
DROP TABLE IF EXISTS integrations;

-- Create new integrations table without RLS
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);