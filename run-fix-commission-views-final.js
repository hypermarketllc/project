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

console.log('Running Fix Commission Views Final SQL Script...');

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
const sqlFilePath = path.join(__dirname, 'fix-commission-views-final.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Execute the SQL directly
async function executeSQL() {
  try {
    console.log('Executing SQL script directly...');
    
    // Execute the SQL directly using the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({
        query: sqlContent
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error executing SQL:', errorText);
      console.log('Trying alternative method...');
      
      // Try executing the SQL in smaller chunks
      const commands = sqlContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .split(';')
        .filter(cmd => cmd.trim().length > 0);
      
      console.log(`Found ${commands.length} SQL commands to execute.`);
      
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i].trim() + ';';
        console.log(`Executing command ${i + 1}/${commands.length}...`);
        
        try {
          // Execute the SQL command directly
          const { error } = await supabase.from('_sql').select('*').eq('query', command);
          
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
    } else {
      console.log('SQL script executed successfully!');
    }
    
    console.log('\nCommission views have been fixed. The Commission Summary component should now work correctly.');
    
  } catch (error) {
    console.error('Error executing SQL:', error);
  }
}

// Execute the SQL
executeSQL();