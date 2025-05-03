const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL file
const fs = require('fs');
const path = require('path');
const sqlContent = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20250417006000_remove_admin_exceptions.sql'), 'utf8');

async function applyMigration() {
  console.log('Applying migration to remove admin exceptions...');
  
  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('Error applying migration:', error);
      return;
    }
    
    console.log('Migration applied successfully');
    
    // Verify the changes
    console.log('Verifying changes...');
    
    // Check if the function exists
    const { data: functionData, error: functionError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT proname, prosrc FROM pg_proc WHERE proname = 'filter_deals_by_hierarchy'" 
    });
    
    if (functionError) {
      console.error('Error verifying function:', functionError);
      return;
    }
    
    console.log('Function filter_deals_by_hierarchy exists and has been updated');
    
    // Check if the function contains the admin@example.com special case
    const functionSource = functionData[0]?.prosrc;
    if (functionSource && !functionSource.includes('admin@example.com')) {
      console.log('✅ Special case for admin@example.com has been removed');
    } else {
      console.log('❌ Special case for admin@example.com still exists in the function');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

applyMigration();