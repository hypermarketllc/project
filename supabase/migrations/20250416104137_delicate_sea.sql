/*
  # Fix Storage and Settings Issues
  
  1. Changes
    - Create storage bucket for logos if it doesn't exist
    - Update system settings to use upsert instead of insert
    - Add proper error handling for duplicate keys
*/

-- Create storage bucket for logos if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('logos', 'logos', true)
  ON CONFLICT (id) DO NOTHING;

  -- Set bucket public access
  UPDATE storage.buckets
  SET public = true
  WHERE id = 'logos';
END $$;

-- Update system settings to handle duplicates properly
CREATE OR REPLACE FUNCTION upsert_settings(
  p_key text,
  p_value jsonb,
  p_description text
) RETURNS void AS $$
BEGIN
  INSERT INTO settings (key, value, description)
  VALUES (p_key, p_value, p_description)
  ON CONFLICT (key) 
  DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;