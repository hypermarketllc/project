const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL files
const fs = require('fs');
const path = require('path');

const migrations = [
  {
    name: 'Remove Admin Exceptions',
    path: 'supabase/migrations/20250417006000_remove_admin_exceptions.sql'
  },
  {
    name: 'Add Discord Integration',
    path: 'supabase/migrations/20250417007000_add_discord_integration.sql'
  }
];

async function applyMigrations() {
  console.log('Applying all migrations...');
  
  for (const migration of migrations) {
    console.log(`\nApplying migration: ${migration.name}`);
    
    try {
      const sqlContent = fs.readFileSync(path.join(__dirname, migration.path), 'utf8');
      
      // Execute the SQL
      const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
      
      if (error) {
        console.error(`Error applying migration ${migration.name}:`, error);
        continue;
      }
      
      console.log(`✅ Migration ${migration.name} applied successfully`);
      
    } catch (error) {
      console.error(`Unexpected error in migration ${migration.name}:`, error);
    }
  }
  
  console.log('\nVerifying migrations...');
  
  // Verify Discord integration
  try {
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'discord');
    
    if (integrationsError) {
      console.error('Error verifying Discord integration:', integrationsError);
    } else if (integrations && integrations.length > 0) {
      console.log('✅ Discord integration exists in the database');
    } else {
      console.log('❌ Discord integration not found in the database');
    }
  } catch (error) {
    console.error('Error checking Discord integration:', error);
  }
  
  // Verify filter_deals_by_hierarchy function (admin exceptions removed)
  try {
    const { data: functionData, error: functionError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT prosrc FROM pg_proc WHERE proname = 'filter_deals_by_hierarchy'" 
    });
    
    if (functionError) {
      console.error('Error verifying filter_deals_by_hierarchy function:', functionError);
    } else if (functionData && functionData.length > 0) {
      const functionSource = functionData[0]?.prosrc;
      if (functionSource && !functionSource.includes('admin@example.com')) {
        console.log('✅ Special case for admin@example.com has been removed from filter_deals_by_hierarchy');
      } else {
        console.log('❌ Special case for admin@example.com still exists in filter_deals_by_hierarchy');
      }
    } else {
      console.log('❌ filter_deals_by_hierarchy function not found');
    }
  } catch (error) {
    console.error('Error checking filter_deals_by_hierarchy function:', error);
  }
  
  console.log('\nAll migrations have been applied!');
  console.log('\nNext steps:');
  console.log('1. Configure the Discord webhook URL in the Integrations section of the Configuration module');
  console.log('2. Test the Discord integration by running: node test-discord-notification.js');
  console.log('3. See DISCORD_INTEGRATION.md for more details on using the Discord integration');
}

applyMigrations();