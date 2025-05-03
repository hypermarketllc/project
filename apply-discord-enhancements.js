const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL file
const fs = require('fs');
const path = require('path');
const sqlContent = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20250417009000_enhance_discord_notifications.sql'), 'utf8');

async function applyMigration() {
  console.log('Applying Discord notification enhancements...');
  
  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('Error applying migration:', error);
      return;
    }
    
    console.log('Discord notification enhancements applied successfully');
    
    // Verify the changes
    console.log('Verifying changes...');
    
    // Check if the count_agent_deals_today function exists
    const { data: countFunctionData, error: countFunctionError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT proname FROM pg_proc WHERE proname = 'count_agent_deals_today'" 
    });
    
    if (countFunctionError) {
      console.error('Error verifying count function:', countFunctionError);
      return;
    }
    
    if (countFunctionData && countFunctionData.length > 0) {
      console.log('✅ count_agent_deals_today function exists');
    } else {
      console.log('❌ count_agent_deals_today function not found');
    }
    
    // Check if the notify_discord_on_deal function has been updated
    const { data: notifyFunctionData, error: notifyFunctionError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT prosrc FROM pg_proc WHERE proname = 'notify_discord_on_deal'" 
    });
    
    if (notifyFunctionError) {
      console.error('Error verifying notify function:', notifyFunctionError);
      return;
    }
    
    if (notifyFunctionData && notifyFunctionData.length > 0) {
      const functionSource = notifyFunctionData[0]?.prosrc;
      if (functionSource && functionSource.includes('💰')) {
        console.log('✅ notify_discord_on_deal function has been updated with emoji');
      } else {
        console.log('❌ notify_discord_on_deal function does not contain emoji');
      }
    } else {
      console.log('❌ notify_discord_on_deal function not found');
    }
    
    console.log('\nDiscord notification enhancements complete!');
    console.log('\nEnhancements include:');
    console.log('1. Added 💰 emoji before and after "New Deal Submitted"');
    console.log('2. Annual premium is now shown in the notification');
    console.log('3. Product information is no longer shown');
    console.log('4. Deal counter for multiple deals by the same agent in one day (x2, x3, etc.)');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

applyMigration();