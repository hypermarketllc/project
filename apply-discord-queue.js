const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL file
const fs = require('fs');
const path = require('path');
const sqlContent = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20250417008000_add_discord_queue.sql'), 'utf8');

async function applyMigration() {
  console.log('Applying Discord queue migration...');
  
  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('Error applying migration:', error);
      return;
    }
    
    console.log('Discord queue migration applied successfully');
    
    // Verify the changes
    console.log('Verifying changes...');
    
    // Check if the discord_notifications table exists
    const { data: tableData, error: tableError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'discord_notifications')" 
    });
    
    if (tableError) {
      console.error('Error verifying table:', tableError);
      return;
    }
    
    if (tableData && tableData[0]?.exists) {
      console.log('✅ discord_notifications table exists');
    } else {
      console.log('❌ discord_notifications table not found');
    }
    
    // Check if the notify_discord_on_deal function exists
    const { data: functionData, error: functionError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT proname FROM pg_proc WHERE proname = 'notify_discord_on_deal'" 
    });
    
    if (functionError) {
      console.error('Error verifying function:', functionError);
      return;
    }
    
    if (functionData && functionData.length > 0) {
      console.log('✅ notify_discord_on_deal function exists');
    } else {
      console.log('❌ notify_discord_on_deal function not found');
    }
    
    // Check if the test_discord_webhook function exists
    const { data: testFunctionData, error: testFunctionError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT proname FROM pg_proc WHERE proname = 'test_discord_webhook'" 
    });
    
    if (testFunctionError) {
      console.error('Error verifying test function:', testFunctionError);
      return;
    }
    
    if (testFunctionData && testFunctionData.length > 0) {
      console.log('✅ test_discord_webhook function exists');
    } else {
      console.log('❌ test_discord_webhook function not found');
    }
    
    console.log('\nDiscord queue setup complete!');
    console.log('\nNext steps:');
    console.log('1. Configure the Discord webhook URL in the Integrations section');
    console.log('2. Test the webhook using the "Test Webhook" button');
    console.log('3. Enable the integration by toggling it to "Active"');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

applyMigration();