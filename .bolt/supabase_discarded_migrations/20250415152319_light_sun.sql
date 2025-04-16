/*
  # Initial Seed Data

  1. Test Data Creation
    - Create positions (Agency Owner, Regional Manager, Agent)
    - Create test users with hierarchy
    - Add sample carriers and products
    - Set up commission splits
*/

-- Insert positions
INSERT INTO positions (id, name, level, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Agency Owner', 1, 'Top level position'),
  ('22222222-2222-2222-2222-222222222222', 'Regional Manager', 2, 'Mid level position'),
  ('33333333-3333-3333-3333-333333333333', 'Agent', 3, 'Entry level position');

-- Insert test users
INSERT INTO users (id, email, full_name, position_id, upline_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@test.com', 'John Owner', '11111111-1111-1111-1111-111111111111', NULL),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager@test.com', 'Jane Manager', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'agent1@test.com', 'Bob Agent', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Insert carriers
INSERT INTO carriers (id, name, advance_rate, contact_name, contact_email) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ABC Insurance', 75.00, 'Sarah Smith', 'sarah@abcins.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'XYZ Life', 80.00, 'Mike Johnson', 'mike@xyzlife.com');

-- Insert products
INSERT INTO products (id, carrier_id, name, type, description) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Term 20', 'Term Life', '20-year term life insurance'),
  ('gggggggg-gggg-gggg-gggg-gggggggggggg', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Whole Life Plus', 'Whole Life', 'Permanent life insurance with cash value'),
  ('hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Universal Life', 'Universal Life', 'Flexible premium universal life');

-- Insert commission splits
INSERT INTO commission_splits (position_id, product_id, percentage) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 10.00),
  ('22222222-2222-2222-2222-222222222222', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 15.00),
  ('33333333-3333-3333-3333-333333333333', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 75.00),
  
  ('11111111-1111-1111-1111-111111111111', 'gggggggg-gggg-gggg-gggg-gggggggggggg', 10.00),
  ('22222222-2222-2222-2222-222222222222', 'gggggggg-gggg-gggg-gggg-gggggggggggg', 15.00),
  ('33333333-3333-3333-3333-333333333333', 'gggggggg-gggg-gggg-gggg-gggggggggggg', 75.00),
  
  ('11111111-1111-1111-1111-111111111111', 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 10.00),
  ('22222222-2222-2222-2222-222222222222', 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 15.00),
  ('33333333-3333-3333-3333-333333333333', 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 75.00);

-- Insert sample deals
INSERT INTO deals (
  agent_id,
  carrier_id,
  product_id,
  client_name,
  client_email,
  monthly_premium,
  annual_premium,
  status
) VALUES
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Alice Customer',
    'alice@example.com',
    100.00,
    1200.00,
    'approved'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
    'Bob Customer',
    'bob@example.com',
    150.00,
    1800.00,
    'pending'
  );

-- Insert some settings
INSERT INTO settings (key, value, description) VALUES
  ('commission_payout_day', '"15"', 'Day of month when commissions are paid'),
  ('minimum_face_amount', '25000', 'Minimum face amount for life insurance policies'),
  ('system_theme', '{"primary": "#4338CA", "secondary": "#0F766E"}', 'System theme colors');