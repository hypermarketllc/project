/*
  # Database Schema Setup - Part 2
  
  1. Sample Data
    - Insert carriers
    - Insert products
    - Insert positions
    - Insert commission splits
    - Insert settings
*/

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