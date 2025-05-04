import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or service role key not found in environment variables.');
  console.error('Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCommissionCalculations() {
  console.log('Checking commission calculations...');
  
  // Get current user ID
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    console.error('Error getting current user:', authError);
    return;
  }
  
  if (!user) {
    console.error('No authenticated user found. Please sign in first.');
    return;
  }
  
  console.log(`Current user ID: ${user.id}`);
  
  // 1. Get all deals
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('*');
  
  if (dealsError) {
    console.error('Error fetching deals:', dealsError);
    return;
  }
  
  console.log(`Found ${deals.length} deals.`);
  console.log('Total Premium:', deals.reduce((sum, deal) => sum + Number(deal.annual_premium || 0), 0));
  
  // 2. Get all commissions
  const { data: commissions, error: commissionsError } = await supabase
    .from('commissions')
    .select('*');
  
  if (commissionsError) {
    console.error('Error fetching commissions:', commissionsError);
    return;
  }
  
  console.log(`Found ${commissions.length} commission records.`);
  
  // 3. Get commissions for current user
  const { data: userCommissions, error: userCommissionsError } = await supabase
    .from('commissions')
    .select('*')
    .eq('user_id', user.id);
  
  if (userCommissionsError) {
    console.error('Error fetching user commissions:', userCommissionsError);
    return;
  }
  
  console.log(`Found ${userCommissions.length} commission records for current user.`);
  
  // 4. Calculate expected values
  const totalPremium = deals.reduce((sum, deal) => sum + Number(deal.annual_premium || 0), 0);
  console.log('Total Premium:', totalPremium);
  
  // Get carrier advance rates
  const { data: carriers, error: carriersError } = await supabase
    .from('carriers')
    .select('*');
  
  if (carriersError) {
    console.error('Error fetching carriers:', carriersError);
    return;
  }
  
  // Calculate expected values for each deal
  let expectedAdvanceTotal = 0;
  let expectedFutureTotal = 0;
  
  for (const deal of deals) {
    const carrier = carriers.find(c => c.id === deal.carrier_id);
    if (!carrier) {
      console.log(`Carrier not found for deal ${deal.id}`);
      continue;
    }
    
    const advanceRate = carrier.advance_rate || 75;
    const advanceAmount = Number(deal.annual_premium) * (advanceRate / 100);
    const futureAmount = Number(deal.annual_premium) - advanceAmount;
    
    expectedAdvanceTotal += advanceAmount;
    expectedFutureTotal += futureAmount;
    
    console.log(`Deal ${deal.id}: Annual Premium = $${deal.annual_premium}, Advance Rate = ${advanceRate}%, Advance Amount = $${advanceAmount.toFixed(2)}, Future Amount = $${futureAmount.toFixed(2)}`);
  }
  
  console.log(`Expected Advance Total: $${expectedAdvanceTotal.toFixed(2)}`);
  console.log(`Expected Future Total: $${expectedFutureTotal.toFixed(2)}`);
  
  // 5. Check actual values in the database
  // Advance commissions
  const advanceCommissions = userCommissions.filter(c => c.commission_type === 'advance' && !c.is_chargeback);
  const advanceTotal = advanceCommissions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  console.log(`Actual Advance Commissions: $${advanceTotal.toFixed(2)}`);
  
  // Future commissions
  const futureCommissions = userCommissions.filter(c => c.commission_type === 'future' && !c.is_chargeback);
  const futureTotal = futureCommissions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  console.log(`Actual Future Commissions: $${futureTotal.toFixed(2)}`);
  
  // Chargebacks
  const chargebacks = userCommissions.filter(c => c.is_chargeback);
  const chargebackTotal = chargebacks.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  console.log(`Actual Chargebacks: $${chargebackTotal.toFixed(2)}`);
  
  // 6. Check money_in_production view
  const { data: mipData, error: mipError } = await supabase
    .from('money_in_production')
    .select('*')
    .eq('user_id', user.id);
  
  if (mipError) {
    console.error('Error fetching money_in_production:', mipError);
  } else if (mipData && mipData.length > 0) {
    console.log('Money in Production view data:');
    console.log(mipData[0]);
  } else {
    console.log('No data found in money_in_production view.');
  }
  
  // 7. Check total_commission view
  const { data: tcData, error: tcError } = await supabase
    .from('total_commission')
    .select('*')
    .eq('user_id', user.id);
  
  if (tcError) {
    console.error('Error fetching total_commission:', tcError);
  } else if (tcData && tcData.length > 0) {
    console.log('Total Commission view data:');
    console.log(tcData[0]);
  } else {
    console.log('No data found in total_commission view.');
  }
  
  // 8. Check future_commission view
  const { data: fcData, error: fcError } = await supabase
    .from('future_commission')
    .select('*')
    .eq('user_id', user.id);
  
  if (fcError) {
    console.error('Error fetching future_commission:', fcError);
  } else if (fcData && fcData.length > 0) {
    console.log('Future Commission view data:');
    console.log(fcData[0]);
  } else {
    console.log('No data found in future_commission view.');
  }
  
  // 9. Check if commissions are being calculated correctly
  console.log('\nChecking individual commission records:');
  for (const commission of userCommissions) {
    console.log(`Commission ID: ${commission.id}`);
    console.log(`  Deal ID: ${commission.deal_id}`);
    console.log(`  Type: ${commission.commission_type}`);
    console.log(`  Amount: $${Number(commission.amount).toFixed(2)}`);
    console.log(`  Is Chargeback: ${commission.is_chargeback}`);
    console.log(`  Payment Date: ${commission.payment_date}`);
    console.log('---');
  }
}

// Run the check
checkCommissionCalculations();