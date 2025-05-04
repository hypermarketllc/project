-- Check Deal Amounts
-- This script checks the actual deals and their advance amounts

-- 1. Check all deals
SELECT 
  id, 
  annual_premium, 
  monthly_premium,
  carrier_id,
  agent_id,
  status,
  created_at
FROM deals;

-- 2. Check carriers and their advance rates
SELECT 
  id, 
  name, 
  advance_rate, 
  advance_period_months, 
  payment_type
FROM carriers;

-- 3. Calculate expected advance amounts
SELECT 
  d.id AS deal_id,
  d.annual_premium,
  c.advance_rate,
  d.annual_premium * (c.advance_rate / 100) AS expected_advance_amount,
  d.annual_premium * (1 - c.advance_rate / 100) AS expected_future_amount
FROM deals d
JOIN carriers c ON d.carrier_id = c.id;

-- 4. Check actual commission records
SELECT 
  c.id,
  c.deal_id,
  c.user_id,
  c.position_id,
  p.name AS position_name,
  c.amount,
  c.percentage,
  c.commission_type,
  c.payment_date,
  c.is_chargeback
FROM commissions c
JOIN positions p ON c.position_id = p.id
ORDER BY c.deal_id, c.commission_type, c.user_id;

-- 5. Calculate total advance and future amounts by position
SELECT 
  p.name AS position_name,
  SUM(CASE WHEN c.commission_type = 'advance' THEN c.amount ELSE 0 END) AS total_advance,
  SUM(CASE WHEN c.commission_type = 'future' THEN c.amount ELSE 0 END) AS total_future,
  SUM(c.amount) AS total_commission
FROM commissions c
JOIN positions p ON c.position_id = p.id
GROUP BY p.name;

-- 6. Calculate total advance and future amounts by user
SELECT 
  u.id AS user_id,
  u.full_name,
  p.name AS position_name,
  SUM(CASE WHEN c.commission_type = 'advance' THEN c.amount ELSE 0 END) AS total_advance,
  SUM(CASE WHEN c.commission_type = 'future' THEN c.amount ELSE 0 END) AS total_future,
  SUM(c.amount) AS total_commission
FROM commissions c
JOIN users u ON c.user_id = u.id
JOIN positions p ON c.position_id = p.id
GROUP BY u.id, u.full_name, p.name;

-- 7. Check money_in_production view
SELECT * FROM money_in_production;

-- 8. Check total_commission view
SELECT * FROM total_commission;

-- 9. Check future_commission view
SELECT * FROM future_commission;

-- 10. Calculate total premium and expected advance
SELECT 
  SUM(annual_premium) AS total_premium,
  SUM(annual_premium) * 0.75 AS expected_advance_75_percent
FROM deals;