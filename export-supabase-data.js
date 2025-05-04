import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

// Create export directory
const exportDir = path.join(process.cwd(), 'supabase-export');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir);
}

// Function to export a table
async function exportTable(tableName) {
  console.log(`Exporting table: ${tableName}`);
  
  try {
    // Get all rows from the table
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.error(`Error fetching data from ${tableName}:`, error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log(`No data found in table ${tableName}`);
      // Still create an empty file to maintain table structure
      fs.writeFileSync(
        path.join(exportDir, `${tableName}.json`),
        JSON.stringify([])
      );
      return;
    }
    
    // Write data to a JSON file
    fs.writeFileSync(
      path.join(exportDir, `${tableName}.json`),
      JSON.stringify(data, null, 2)
    );
    
    console.log(`Successfully exported ${data.length} rows from ${tableName}`);
  } catch (err) {
    console.error(`Error exporting table ${tableName}:`, err);
  }
}

// Function to get all tables
async function getAllTables() {
  try {
    const { data, error } = await supabase
      .rpc('get_all_tables');
    
    if (error) {
      console.error('Error fetching tables:', error);
      
      // Fallback to a list of known tables
      console.log('Using fallback list of tables...');
      return [
        'users',
        'positions',
        'carriers',
        'products',
        'deals',
        'commissions',
        'commission_splits',
        'discord_notifications',
        'discord_queue',
        'telegram_chats'
      ];
    }
    
    return data.map(table => table.table_name);
  } catch (err) {
    console.error('Error getting tables:', err);
    process.exit(1);
  }
}

// Function to export schema
async function exportSchema() {
  try {
    console.log('Exporting database schema...');
    
    // Get all tables
    const tables = await getAllTables();
    
    // Get schema for each table
    const schema = {};
    
    for (const tableName of tables) {
      const { data, error } = await supabase
        .rpc('get_table_schema', { table_name: tableName });
      
      if (error) {
        console.error(`Error fetching schema for ${tableName}:`, error);
        continue;
      }
      
      schema[tableName] = data;
    }
    
    // Write schema to a JSON file
    fs.writeFileSync(
      path.join(exportDir, 'schema.json'),
      JSON.stringify(schema, null, 2)
    );
    
    console.log('Successfully exported database schema');
    return tables;
  } catch (err) {
    console.error('Error exporting schema:', err);
    process.exit(1);
  }
}

// Main function
async function main() {
  console.log('Starting Supabase data export...');
  
  try {
    // Export schema and get tables
    const tables = await exportSchema();
    
    // Export each table
    for (const tableName of tables) {
      await exportTable(tableName);
    }
    
    // Generate SQL script for creating tables
    console.log('Generating SQL script for creating tables...');
    
    // Read schema
    const schema = JSON.parse(fs.readFileSync(path.join(exportDir, 'schema.json'), 'utf8'));
    
    let sqlScript = '-- SQL script for creating tables\n\n';
    
    // Add table creation statements
    for (const [tableName, tableSchema] of Object.entries(schema)) {
      sqlScript += `-- Table: ${tableName}\n`;
      sqlScript += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
      
      const columns = tableSchema.map(column => {
        let columnDef = `  "${column.column_name}" ${column.data_type}`;
        
        if (column.is_nullable === 'NO') {
          columnDef += ' NOT NULL';
        }
        
        if (column.column_default) {
          columnDef += ` DEFAULT ${column.column_default}`;
        }
        
        return columnDef;
      });
      
      // Add primary key if available
      const primaryKey = tableSchema.find(column => column.constraint_type === 'PRIMARY KEY');
      if (primaryKey) {
        columns.push(`  PRIMARY KEY ("${primaryKey.column_name}")`);
      }
      
      sqlScript += columns.join(',\n');
      sqlScript += '\n);\n\n';
    }
    
    // Write SQL script to a file
    fs.writeFileSync(
      path.join(exportDir, 'create_tables.sql'),
      sqlScript
    );
    
    // Generate SQL script for inserting data
    console.log('Generating SQL script for inserting data...');
    
    let insertScript = '-- SQL script for inserting data\n\n';
    
    for (const tableName of tables) {
      const dataFile = path.join(exportDir, `${tableName}.json`);
      
      if (!fs.existsSync(dataFile)) {
        console.log(`No data file found for ${tableName}`);
        continue;
      }
      
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      
      if (data.length === 0) {
        console.log(`No data to insert for ${tableName}`);
        continue;
      }
      
      insertScript += `-- Data for table: ${tableName}\n`;
      
      for (const row of data) {
        const columns = Object.keys(row).filter(key => row[key] !== null);
        const values = columns.map(column => {
          const value = row[column];
          
          if (typeof value === 'string') {
            // Escape single quotes in string values
            return `'${value.replace(/'/g, "''")}'`;
          } else if (typeof value === 'object') {
            // Convert objects to JSON strings
            return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
          } else {
            return value;
          }
        });
        
        insertScript += `INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
      }
      
      insertScript += '\n';
    }
    
    // Write insert script to a file
    fs.writeFileSync(
      path.join(exportDir, 'insert_data.sql'),
      insertScript
    );
    
    console.log('Export completed successfully!');
    console.log(`Data exported to: ${exportDir}`);
    console.log('The following files were created:');
    console.log('- schema.json: Database schema');
    console.log('- create_tables.sql: SQL script for creating tables');
    console.log('- insert_data.sql: SQL script for inserting data');
    console.log('- [table_name].json: Data for each table');
  } catch (err) {
    console.error('Error during export:', err);
    process.exit(1);
  }
}

// Run the main function
main();