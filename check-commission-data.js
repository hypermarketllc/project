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

async function checkData() {
  console.log('Checking commission data...');
  
  // Check if commissions table exists
  const { data: tableExists, error: tableError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'commissions');
  
  if (tableError) {
    console.error('Error checking if commissions table exists:', tableError);
    return;
  }
  
  if (!tableExists || tableExists.length === 0) {
    console.error('Commissions table does not exist!');
    return;
  }
  
  console.log('Commissions table exists.');
  
  // Check if there are any records in the commissions table
  const { data: commissionCount, error: countError } = await supabase
    .from('commissions')
    .select('id', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Error checking commission count:', countError);
    return;
  }
  
  console.log(`Found ${commissionCount?.length || 0} commission records.`);
  
  // Check money_in_production view
  const { data: mipData, error: mipError } = await supabase
    .from('money_in_production')
    .select('*');
  
  if (mipError) {
    console.error('Error querying money_in_production view:', mipError);
  } else {
    console.log('money_in_production data:');
    console.log(mipData);
  }
  
  // Check total_commission view
  const { data: tcData, error: tcError } = await supabase
    .from('total_commission')
    .select('*');
  
  if (tcError) {
    console.error('Error querying total_commission view:', tcError);
  } else {
    console.log('total_commission data:');
    console.log(tcData);
  }
  
  // Check future_commission view
  const { data: fcData, error: fcError } = await supabase
    .from('future_commission')
    .select('*');
  
  if (fcError) {
    console.error('Error querying future_commission view:', fcError);
  } else {
    console.log('future_commission data:');
    console.log(fcData);
  }
  
  // Check if there are any deals
  const { data: dealCount, error: dealCountError } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true });
  
  if (dealCountError) {
    console.error('Error checking deal count:', dealCountError);
    return;
  }
  
  console.log(`Found ${dealCount?.length || 0} deal records.`);
  
  // If no commissions found, check if calculate_deal_commissions function exists
  if (commissionCount?.length === 0) {
    console.log('No commission records found. Checking if calculate_deal_commissions function exists...');
    
    const { data: functionExists, error: functionError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_schema', 'public')
      .eq('routine_name', 'calculate_deal_commissions');
    
    if (functionError) {
      console.error('Error checking if calculate_deal_commissions function exists:', functionError);
      return;
    }
    
    if (!functionExists || functionExists.length === 0) {
      console.error('calculate_deal_commissions function does not exist!');
      console.log('Please run the commission-logic-sql.sql script first to create the function.');
      return;
    }
    
    console.log('calculate_deal_commissions function exists.');
    
    // If deals exist but no commissions, try to calculate commissions for existing deals
    if (dealCount?.length > 0) {
      console.log('Deals exist but no commissions found. Trying to calculate commissions for existing deals...');
      
      // Get all active deals
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('*')
        .eq('status', 'active');
      
      if (dealsError) {
        console.error('Error fetching deals:', dealsError);
        return;
      }
      
      if (!deals || deals.length === 0) {
        console.log('No active deals found.');
        return;
      }
      
      console.log(`Found ${deals.length} active deals. Calculating commissions...`);
      
      // Calculate commissions for each deal
      for (const deal of deals) {
        console.log(`Calculating commissions for deal ${deal.id}...`);
        
        try {
          const { error: calcError } = await supabase.rpc('calculate_deal_commissions', {
            p_deal_id: deal.id
          });
          
          if (calcError) {
            console.error(`Error calculating commissions for deal ${deal.id}:`, calcError);
          } else {
            console.log(`Successfully calculated commissions for deal ${deal.id}.`);
          }
        } catch (error) {
          console.error(`Error calculating commissions for deal ${deal.id}:`, error);
        }
      }
      
      // Check commission count again
      const { data: newCommissionCount, error: newCountError } = await supabase
        .from('commissions')
        .select('id', { count: 'exact', head: true });
      
      if (newCountError) {
        console.error('Error checking new commission count:', newCountError);
        return;
      }
      
      console.log(`Now found ${newCommissionCount?.length || 0} commission records.`);
    }
  }
}

// Run the check
checkData();