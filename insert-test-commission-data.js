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

async function insertTestData() {
  console.log('Inserting test commission data...');
  
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
  
  // Check if positions exist
  const { data: positions, error: positionsError } = await supabase
    .from('positions')
    .select('*');
  
  if (positionsError) {
    console.error('Error fetching positions:', positionsError);
    return;
  }
  
  if (!positions || positions.length === 0) {
    console.error('No positions found. Please create positions first.');
    return;
  }
  
  console.log('Positions found:', positions);
  
  // Find agent and owner positions
  const agentPosition = positions.find(p => p.name.toLowerCase() === 'agent');
  const ownerPosition = positions.find(p => p.name.toLowerCase() === 'owner');
  
  if (!agentPosition) {
    console.error('Agent position not found.');
    return;
  }
  
  if (!ownerPosition) {
    console.error('Owner position not found.');
    return;
  }
  
  // Get user details
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (userError) {
    console.error('Error fetching user details:', userError);
    return;
  }
  
  console.log('User details:', userData);
  
  // Insert test commission data directly
  const today = new Date();
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 3); // 3 months in the future
  
  const commissionData = [
    // Advance payments (current)
    {
      user_id: user.id,
      position_id: userData.position_id || agentPosition.id,
      deal_id: null, // No deal ID for test data
      amount: 250.00,
      percentage: 40,
      commission_type: 'advance',
      payment_date: today.toISOString().split('T')[0],
      is_chargeback: false
    },
    // Monthly payments (current)
    {
      user_id: user.id,
      position_id: userData.position_id || agentPosition.id,
      deal_id: null,
      amount: 50.00,
      percentage: 40,
      commission_type: 'monthly',
      payment_date: today.toISOString().split('T')[0],
      is_chargeback: false
    },
    // Chargebacks
    {
      user_id: user.id,
      position_id: userData.position_id || agentPosition.id,
      deal_id: null,
      amount: -75.00,
      percentage: 40,
      commission_type: 'advance',
      payment_date: today.toISOString().split('T')[0],
      is_chargeback: true,
      chargeback_date: today.toISOString().split('T')[0]
    },
    // Future commission
    {
      user_id: user.id,
      position_id: userData.position_id || agentPosition.id,
      deal_id: null,
      amount: 496.40,
      percentage: 40,
      commission_type: 'future',
      payment_date: futureDate.toISOString().split('T')[0],
      is_chargeback: false
    }
  ];
  
  // Insert the test data
  const { data: insertedData, error: insertError } = await supabase
    .from('commissions')
    .insert(commissionData)
    .select();
  
  if (insertError) {
    console.error('Error inserting test commission data:', insertError);
    return;
  }
  
  console.log('Successfully inserted test commission data:', insertedData);
  console.log('Please refresh your dashboard to see the updated commission data.');
}

// Run the insert
insertTestData();