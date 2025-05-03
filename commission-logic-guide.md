# MyAgentView Commission Logic Guide

## Overview

This document outlines the commission structure and calculation logic for the MyAgentView CRM system, focusing on a simplified two-tier structure with Agent and Owner positions.

## Position Structure

1. **Agent**: The person who closes the deal - receives a configured commission percentage
2. **Owner**: The agency owner - receives the remainder of the commission

## Carrier Payment Types

### 1. Advance Payment Carriers
- Pay a percentage of annual premium upfront (e.g., 75% for 9 months)
- Require full chargeback if policy lapses during advance period
- Generate both immediate and future commission records

### 2. Monthly Payment Carriers
- Pay commissions monthly as premiums are collected
- No chargebacks on policy cancellation
- Generate monthly commission records for each payment period

## Commission Calculation Examples

### Example 1: Advance Payment Carrier

**Setup:**
- Carrier: ABC Insurance
- Advance Rate: 75% (9 months advance)
- Agent Commission: 40%
- Owner Commission: 60% (100% - 40%)

**Deal Details:**
- Monthly Premium: $100
- Annual Premium: $1,200

**Carrier Payments:**
- Advance Payment: $1,200 × 75% = $900
- Future Payment (after 9 months): $1,200 × 25% = $300

**Commission Distribution:**

1. **Immediate Commissions (from advance):**
   ```
   Agent: $900 × 40% = $360
   Owner: $900 × 60% = $540
   Total: $900
   ```

2. **Future Commissions (after 9 months):**
   ```
   Agent: $300 × 40% = $120
   Owner: $300 × 60% = $180
   Total: $300
   ```

**If Policy Lapses During Advance Period (e.g., Month 6):**
- Full advance must be returned: $900
- Agent returns: $900 × 40% = $360
- Owner returns: $900 × 60% = $540
- All future commissions are cancelled

**If Policy Lapses After Advance Period (e.g., Month 12):**
- No chargebacks required
- Keep all advance commissions
- Lose only remaining future payments

### Example 2: Monthly Payment Carrier

**Setup:**
- Carrier: XYZ Insurance  
- Payment Type: Monthly
- Agent Commission: 40%
- Owner Commission: 60%

**Deal Details:**
- Monthly Premium: $100
- Annual Premium: $1,200

**Monthly Commission Calculation:**
Each month when carrier pays $100:
```
Agent: $100 × 40% = $40
Owner: $100 × 60% = $60
Total: $100
```

**12-Month Total:**
```
Agent: $40 × 12 = $480
Owner: $60 × 12 = $720
Total: $1,200
```

**If Policy Cancels (e.g., Month 6):**
- Total Received: 6 months × $100 = $600
- Agent Earned: 6 months × $40 = $240
- Owner Earned: 6 months × $60 = $360
- No chargebacks required
- Future monthly commissions simply stop

## Dashboard Metrics

### 1. Money in Production
- **Definition**: Total advance payments received from carriers
- **Calculation**: Sum of all advance payments received
- **Example**: 10 policies × $900 advance = $9,000
- **Note**: Does not include monthly payments

### 2. Total Commission
- **Definition**: Commissions actually earned and paid to date
- **Includes**:
  - Paid advance commissions
  - Paid monthly commissions
  - Excludes unpaid future commissions
- **Example**: Agent has received $5,000 in paid commissions

### 3. Future Commission
- **Definition**: Commissions eligible after advance period or pending monthly payments
- **Includes**:
  - Renewal commissions after advance period
  - Unpaid monthly commissions
- **Example**: $2,000 in future commissions pending

## Chargeback Rules

### For Advance Payment Carriers:
1. **Trigger**: Policy lapses during advance period
2. **Amount**: Full advance payment must be returned
3. **Calculation**: 
   - Agent returns: Advance × Agent commission %
   - Owner returns: Advance × Owner commission %
4. **Impact**: All future commissions cancelled

### For Monthly Payment Carriers:
1. **Trigger**: Policy cancellation at any time
2. **Amount**: No chargebacks required
3. **Impact**: Future monthly commissions stop

## Policy Status Impact

### Active Policy
- Commissions processed normally
- Future commissions remain scheduled

### Lapsed Policy (Advance Carrier)
- If during advance period: Full chargeback required
- If after advance period: No chargeback, future commissions cancelled
- Status updated to "lapsed"

### Lapsed Policy (Monthly Carrier)
- No chargebacks at any time
- Future monthly commissions cancelled
- Status updated to "lapsed"

### Reinstated Policy
- Resume normal commission processing
- Recalculate future commission schedule
- No recovery of previously cancelled commissions

## Business Rules Summary

1. **Commission Split**:
   - Agent receives configured percentage
   - Owner receives remainder (100% - Agent %)

2. **Advance Carriers**:
   - Pay upfront based on advance rate
   - Full chargeback if lapse during advance period
   - No chargeback if lapse after advance period

3. **Monthly Carriers**:
   - Pay as premiums collected
   - No chargebacks ever
   - Commissions stop when policy cancels

4. **Timing**:
   - Advance commissions: Paid immediately
   - Future commissions: Paid after advance period
   - Monthly commissions: Paid as received from carrier

5. **Chargeback Period**:
   - Only during advance period (typically 9 months)
   - Full advance amount must be returned
   - Proportional to original commission split

## Configuration Requirements

### Carrier Configuration:
- Payment type (advance or monthly)
- Advance rate (if applicable)
- Advance period length (if applicable)

### Product Configuration:
- Commission percentages by position
- Agent percentage explicitly set
- Owner automatically gets remainder

### System Tracking:
- Deal creation date
- Policy status changes
- Commission payment status
- Chargeback processing
- Future commission eligibility dates