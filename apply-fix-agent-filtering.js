const fs = require('fs');
const { execSync } = require('child_process');
const { Client } = require('pg');
require('dotenv').config();

// Read the SQL file
const sqlContent = fs.readFileSync('./supabase/migrations/20250417005000_fix_new_accounts.sql', 'utf8');

// Connect to the database
async function applyFix() {
  console.log('Applying fix for agent filtering...');
  
  try {
    // Get database connection details from .env file
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      console.error('Error: DATABASE_URL not found in .env file');
      console.log('Please add your Supabase database URL to the .env file:');
      console.log('DATABASE_URL=postgres://postgres:password@your-project-ref.supabase.co:5432/postgres');
      return;
    }
    
    const client = new Client({
      connectionString,
    });
    
    await client.connect();
    console.log('Connected to database');
    
    // Execute the SQL
    console.log('Executing SQL...');
    await client.query(sqlContent);
    
    console.log('SQL executed successfully');
    
    // Verify the changes
    console.log('Verifying changes...');
    
    // Check if the trigger exists
    const triggerResult = await client.query(`
      SELECT * FROM pg_trigger 
      WHERE tgname = 'set_default_position_trigger'
    `);
    
    if (triggerResult.rows.length > 0) {
      console.log('✅ Trigger set_default_position_trigger created successfully');
    } else {
      console.log('❌ Trigger set_default_position_trigger not found');
    }
    
    // Check if the function exists
    const functionResult = await client.query(`
      SELECT * FROM pg_proc 
      WHERE proname = 'set_default_position'
    `);
    
    if (functionResult.rows.length > 0) {
      console.log('✅ Function set_default_position created successfully');
    } else {
      console.log('❌ Function set_default_position not found');
    }
    
    // Check if the filter_deals_by_hierarchy function was updated
    const filterFunctionResult = await client.query(`
      SELECT * FROM pg_proc 
      WHERE proname = 'filter_deals_by_hierarchy'
    `);
    
    if (filterFunctionResult.rows.length > 0) {
      console.log('✅ Function filter_deals_by_hierarchy updated successfully');
    } else {
      console.log('❌ Function filter_deals_by_hierarchy not found');
    }
    
    // Check if there are any users without a position
    const usersWithoutPositionResult = await client.query(`
      SELECT COUNT(*) FROM users WHERE position_id IS NULL
    `);
    
    const usersWithoutPosition = parseInt(usersWithoutPositionResult.rows[0].count);
    if (usersWithoutPosition === 0) {
      console.log('✅ All users have a position assigned');
    } else {
      console.log(`❌ There are still ${usersWithoutPosition} users without a position`);
    }
    
    await client.end();
    console.log('Fix applied successfully');
  } catch (error) {
    console.error('Error applying fix:', error);
  }
}

applyFix();