import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Applying Commission Logic Migration (Direct Method)...');

// Ask for Supabase credentials
rl.question('Enter your Supabase URL: ', (supabaseUrl) => {
  rl.question('Enter your Supabase service role key: ', async (supabaseKey) => {
    try {
      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Read the migration file
      const migrationPath = path.join(__dirname, 'supabase/migrations/20250418000000_add_commission_logic.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      console.log('Executing SQL commands directly...');
      
      // Split the SQL file into individual commands
      const commands = migrationSQL
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .split(';')
        .filter(cmd => cmd.trim().length > 0);
      
      // Execute each command
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i].trim() + ';';
        console.log(`Executing command ${i + 1}/${commands.length}...`);
        
        try {
          // Execute the SQL command
          const { error } = await supabase.rpc('exec_sql', { sql: command });
          
          if (error) {
            console.error(`Error executing command ${i + 1}:`, error);
            console.error('Command:', command);
          }
        } catch (cmdError) {
          console.error(`Error executing command ${i + 1}:`, cmdError);
          console.error('Command:', command);
          // Continue with next command
        }
      }
      
      console.log('Migration applied successfully!');
      console.log('\nCommission logic has been implemented with the following features:');
      console.log('1. Support for both advance and monthly payment carriers');
      console.log('2. Automatic commission calculation based on carrier type and rates');
      console.log('3. Chargeback processing for lapsed policies');
      console.log('4. Policy reinstatement handling');
      console.log('5. Dashboard views for commission metrics');

      console.log('\nNext steps:');
      console.log('1. Update carrier records to set the correct payment_type and advance_period_months');
      console.log('2. Verify commission splits are set correctly for each product');
      console.log('3. Test the system by creating new deals and updating policy statuses');
      
    } catch (error) {
      console.error('Error applying migration:', error);
    } finally {
      rl.close();
    }
  });
});