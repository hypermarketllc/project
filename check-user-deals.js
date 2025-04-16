import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { argv } from 'process';

// Initialize dotenv
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserDeals() {
  
  try {
    // First, get the user ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, position_id')
      .eq('email', email)
      .single();
    
    if (userError) {
      console.error('Error fetching user:', userError);
      return;
    }
    
    if (!userData) {
      console.log(`No user found with email: ${email}`);
      return;
    }
    
    console.log('User found:');
    console.log(userData);
    
    // Get position info
    const { data: positionData, error: positionError } = await supabase
      .from('positions')
      .select('id, name, level')
      .eq('id', userData.position_id)
      .single();
    
    if (positionError && positionError.code !== 'PGRST116') {
      console.error('Error fetching position:', positionError);
    } else if (positionData) {
      console.log('Position:');
      console.log(positionData);
    } else {
      console.log('No position found for this user');
    }
    
    // Get deals for this user
    const { data: dealsData, error: dealsError } = await supabase
      .from('deals')
      .select('*')
      .eq('agent_id', userData.id);
    
    if (dealsError) {
      console.error('Error fetching deals:', dealsError);
      return;
    }
    
    console.log(`Found ${dealsData.length} deals for user ${email}:`);
    if (dealsData.length > 0) {
      dealsData.forEach((deal, index) => {
        console.log(`Deal ${index + 1}:`);
        console.log(`  ID: ${deal.id}`);
        console.log(`  Client: ${deal.client_name}`);
        console.log(`  Premium: $${deal.annual_premium}`);
        console.log(`  Created: ${deal.created_at}`);
        console.log('---');
      });
    }
    
    // Check if there are any deals with NULL agent_id
    const { data: nullAgentDeals, error: nullAgentError } = await supabase
      .from('deals')
      .select('*')
      .is('agent_id', null);
    
    if (nullAgentError) {
      console.error('Error checking for NULL agent_id deals:', nullAgentError);
    } else {
      console.log(`Found ${nullAgentDeals.length} deals with NULL agent_id`);
      if (nullAgentDeals.length > 0) {
        console.log('First 5 deals with NULL agent_id:');
        nullAgentDeals.slice(0, 5).forEach((deal, index) => {
          console.log(`Deal ${index + 1}:`);
          console.log(`  ID: ${deal.id}`);
          console.log(`  Client: ${deal.client_name}`);
          console.log(`  Premium: $${deal.annual_premium}`);
          console.log('---');
        });
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Get email from command line arguments
const email = argv[2];

if (!email) {
  console.error('Please provide an email address as an argument');
  console.log('Usage: node check-user-deals.js user@example.com');
  process.exit(1);
}

// Call the function
checkUserDeals();