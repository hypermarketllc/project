const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL file
const fs = require('fs');
const path = require('path');
const sqlContent = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20250417010000_prevent_duplicate_notifications.sql'), 'utf8');

async function applyMigration() {
  console.log('Applying duplicate prevention migration...');
  
  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('Error applying migration:', error);
      return;
    }
    
    console.log('Duplicate prevention migration applied successfully');
    
    // Verify the changes
    console.log('Verifying changes...');
    
    // Check if the unique constraint exists
    const { data: constraintData, error: constraintError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT conname FROM pg_constraint WHERE conname = 'unique_deal_notification'" 
    });
    
    if (constraintError) {
      console.error('Error verifying constraint:', constraintError);
      return;
    }
    
    if (constraintData && constraintData.length > 0) {
      console.log('✅ unique_deal_notification constraint exists');
    } else {
      console.log('❌ unique_deal_notification constraint not found');
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
      if (functionSource && functionSource.includes('notification_exists')) {
        console.log('✅ notify_discord_on_deal function has been updated with duplicate prevention');
      } else {
        console.log('❌ notify_discord_on_deal function does not contain duplicate prevention');
      }
    } else {
      console.log('❌ notify_discord_on_deal function not found');
    }
    
    console.log('\nDuplicate prevention complete!');
    console.log('\nEnhancements include:');
    console.log('1. Added unique constraint to prevent duplicate notifications for the same deal');
    console.log('2. Added check before inserting to prevent duplicates');
    console.log('3. Ensured annual premium is always shown in notifications');
    console.log('4. Updated test function to handle duplicates');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

applyMigration();