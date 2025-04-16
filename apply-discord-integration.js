const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL file
const fs = require('fs');
const path = require('path');
const sqlContent = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20250417007000_add_discord_integration.sql'), 'utf8');

async function applyMigration() {
  console.log('Applying Discord integration migration...');
  
  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('Error applying migration:', error);
      return;
    }
    
    console.log('Discord integration migration applied successfully');
    
    // Verify the changes
    console.log('Verifying changes...');
    
    // Check if the Discord integration exists
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'discord');
    
    if (integrationsError) {
      console.error('Error verifying integrations:', integrationsError);
      return;
    }
    
    if (integrations && integrations.length > 0) {
      console.log('✅ Discord integration exists in the database');
      console.log('Integration details:', integrations[0]);
    } else {
      console.log('❌ Discord integration not found in the database');
    }
    
    // Check if the trigger function exists
    const { data: functionData, error: functionError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT proname, prosrc FROM pg_proc WHERE proname = 'notify_discord_on_deal'" 
    });
    
    if (functionError) {
      console.error('Error verifying function:', functionError);
      return;
    }
    
    if (functionData && functionData.length > 0) {
      console.log('✅ Discord notification function exists');
    } else {
      console.log('❌ Discord notification function not found');
    }
    
    // Check if the trigger exists
    const { data: triggerData, error: triggerError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_discord_notification_on_deal'" 
    });
    
    if (triggerError) {
      console.error('Error verifying trigger:', triggerError);
      return;
    }
    
    if (triggerData && triggerData.length > 0) {
      console.log('✅ Discord notification trigger exists');
    } else {
      console.log('❌ Discord notification trigger not found');
    }
    
    console.log('Discord integration setup complete!');
    console.log('You can now configure the webhook URL in the Integrations section of the Configuration module.');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

applyMigration();