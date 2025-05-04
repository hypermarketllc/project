# Commission Logic Implementation

This document explains how the commission logic has been implemented in the MyAgentView CRM system based on the requirements in the commission-logic-guide.md.

## Database Changes

### 1. Carrier Table Updates
- Added `payment_type` field (values: 'advance' or 'monthly')
- Added `advance_period_months` field (default: 9)

### 2. Position Table
- Ensured Agent and Owner positions exist with correct levels

### 3. Commission Table Updates
- Added `commission_type` field (values: 'advance', 'future', or 'monthly')
- Added `payment_date` field to track when commissions are due
- Added `is_chargeback` field to identify chargeback records
- Added `chargeback_date` field for when chargebacks occur
- Added `original_commission_id` field to link chargebacks to original commissions

## Core Functions

### 1. `calculate_commissions(deal_id)`
This function calculates commissions for a deal based on:
- Carrier payment type (advance or monthly)
- Advance rate and period
- Agent and Owner commission percentages

For advance payment carriers:
- Creates immediate advance commission records
- Creates future commission records for after the advance period

For monthly payment carriers:
- Creates 12 monthly commission records

### 2. `process_chargeback(deal_id)`
This function processes chargebacks when a policy lapses:

For advance payment carriers:
- If during advance period: Creates chargeback records and cancels future commissions
- If after advance period: Only cancels future commissions

For monthly payment carriers:
- Cancels future monthly commissions

### 3. `reinstate_policy(deal_id)`
This function handles policy reinstatements:
- Updates deal status to active
- Reactivates cancelled future commissions

## Triggers

### 1. `deal_commission_trigger`
- Automatically calculates commissions when a new deal is created

### 2. `deal_status_trigger`
- Processes chargebacks when a deal status changes to 'lapsed'
- Handles reinstatements when a deal status changes from 'lapsed' to 'active'

## Dashboard Views

### 1. `money_in_production`
- Shows total advance payments
- Shows total monthly payments
- Shows total chargebacks
- Calculates net production

### 2. `total_commission`
- Shows paid commissions by agent/position
- Shows pending commissions
- Shows chargebacks
- Calculates net commission

### 3. `future_commission`
- Shows future commissions by agent/position

## Usage Examples

### Example 1: Advance Payment Carrier

For a deal with:
- Annual premium: $1,200
- Carrier advance rate: 75%
- Agent commission: 40%
- Owner commission: 60%

The system will:
1. Calculate advance amount: $1,200 × 75% = $900
2. Calculate future amount: $1,200 × 25% = $300
3. Create advance commission records:
   - Agent: $900 × 40% = $360
   - Owner: $900 × 60% = $540
4. Create future commission records:
   - Agent: $300 × 40% = $120
   - Owner: $300 × 60% = $180

If the policy lapses during the advance period:
1. Create chargeback records:
   - Agent: -$360
   - Owner: -$540
2. Cancel future commissions

### Example 2: Monthly Payment Carrier

For a deal with:
- Monthly premium: $100
- Agent commission: 40%
- Owner commission: 60%

The system will create 12 monthly commission records:
- Agent: $100 × 40% = $40 per month
- Owner: $100 × 60% = $60 per month

If the policy lapses after 6 months:
- Keep the first 6 months of commissions
- Cancel the remaining 6 months of commissions

## Configuration Steps

1. Update carrier records:
   ```sql
   UPDATE carriers
   SET payment_type = 'advance', -- or 'monthly'
       advance_rate = 75, -- percentage
       advance_period_months = 9
   WHERE id = 'carrier_id';
   ```

2. Set commission splits:
   ```sql
   INSERT INTO commission_splits (position_id, product_id, percentage)
   VALUES 
     ('agent_position_id', 'product_id', 40);
   ```

3. Create a deal:
   ```sql
   INSERT INTO deals (agent_id, carrier_id, product_id, client_name, monthly_premium, annual_premium, status)
   VALUES ('agent_id', 'carrier_id', 'product_id', 'Client Name', 100, 1200, 'active');
   ```
   - Commissions will be calculated automatically

4. Process a lapse:
   ```sql
   UPDATE deals
   SET status = 'lapsed'
   WHERE id = 'deal_id';
   ```
   - Chargebacks will be processed automatically

5. Reinstate a policy:
   ```sql
   UPDATE deals
   SET status = 'active'
   WHERE id = 'deal_id';
   ```
   - Future commissions will be reactivated automatically

## Reporting

Use the dashboard views to get commission metrics:

```sql
-- Money in production
SELECT * FROM money_in_production;

-- Total commission by agent
SELECT * FROM total_commission;

-- Future commission by agent
SELECT * FROM future_commission;