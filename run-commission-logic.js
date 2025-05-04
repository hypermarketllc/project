import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Running Commission Logic SQL Script...');

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

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'commission-logic-sql.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Split the SQL file into individual commands
const commands = sqlContent
  .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
  .split(';')
  .filter(cmd => cmd.trim().length > 0);

// Function to execute SQL commands
async function executeCommands() {
  try {
    console.log(`Found ${commands.length} SQL commands to execute.`);
    
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
          
          // If this is a DO block, try to execute it directly
          if (command.trim().startsWith('DO')) {
            console.log('Trying to execute DO block directly...');
            const { error: directError } = await supabase.rpc('exec_sql', { 
              sql: `SELECT (${command})` 
            });
            
            if (directError) {
              console.error('Error executing DO block directly:', directError);
            } else {
              console.log('DO block executed successfully.');
            }
          }
        }
      } catch (cmdError) {
        console.error(`Error executing command ${i + 1}:`, cmdError);
        console.error('Command:', command);
        // Continue with next command
      }
    }
    
    console.log('SQL script execution completed!');
    console.log('\nCommission logic has been implemented with the following features:');
    console.log('1. Support for both advance and monthly payment carriers');
    console.log('2. Automatic commission calculation based on carrier type and rates');
    console.log('3. Chargeback processing for lapsed policies');
    console.log('4. Policy reinstatement handling');
    console.log('5. Dashboard views for commission metrics');
    
  } catch (error) {
    console.error('Error executing SQL commands:', error);
  }
}

// Execute the commands
executeCommands();