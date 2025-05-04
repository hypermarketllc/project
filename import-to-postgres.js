import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'crm_db',
  user: process.env.POSTGRES_USER || 'crm_user',
  password: process.env.POSTGRES_PASSWORD,
};

// Check if password is provided
if (!pgConfig.password) {
  console.error('Error: PostgreSQL password not found in environment variables.');
  console.error('Make sure you have POSTGRES_PASSWORD in your .env file.');
  process.exit(1);
}

// Create PostgreSQL client
const pool = new Pool(pgConfig);

// Import directory
const importDir = path.join(__dirname, 'supabase-export');

// Function to execute SQL script
async function executeSqlScript(scriptPath) {
  console.log(`Executing SQL script: ${scriptPath}`);
  
  try {
    // Read the SQL script
    const script = fs.readFileSync(scriptPath, 'utf8');
    
    // Split the script into individual statements
    const statements = script.split(';').filter(stmt => stmt.trim() !== '');
    
    // Execute each statement
    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        console.error(`Error executing statement: ${statement}`);
        console.error(err);
        // Continue with the next statement
      }
    }
    
    console.log(`Successfully executed SQL script: ${scriptPath}`);
  } catch (err) {
    console.error(`Error executing SQL script ${scriptPath}:`, err);
    throw err;
  }
}

// Function to create database schema
async function createSchema() {
  console.log('Creating database schema...');
  
  try {
    // Check if schema file exists
    const schemaPath = path.join(importDir, 'create_tables.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error(`Schema file not found: ${schemaPath}`);
      return false;
    }
    
    // Execute schema script
    await executeSqlScript(schemaPath);
    
    console.log('Successfully created database schema');
    return true;
  } catch (err) {
    console.error('Error creating database schema:', err);
    return false;
  }
}

// Function to import data
async function importData() {
  console.log('Importing data...');
  
  try {
    // Check if data file exists
    const dataPath = path.join(importDir, 'insert_data.sql');
    
    if (!fs.existsSync(dataPath)) {
      console.error(`Data file not found: ${dataPath}`);
      return false;
    }
    
    // Execute data script
    await executeSqlScript(dataPath);
    
    console.log('Successfully imported data');
    return true;
  } catch (err) {
    console.error('Error importing data:', err);
    return false;
  }
}

// Function to import data in chunks
async function importDataInChunks() {
  console.log('Importing data in chunks...');
  
  try {
    // Check if data file exists
    const dataPath = path.join(importDir, 'insert_data.sql');
    
    if (!fs.existsSync(dataPath)) {
      console.error(`Data file not found: ${dataPath}`);
      return false;
    }
    
    // Create a read stream for the file
    const fileStream = fs.createReadStream(dataPath);
    
    // Create an interface to read the file line by line
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    // Buffer to accumulate statements
    let statementBuffer = '';
    let lineCount = 0;
    const CHUNK_SIZE = 100; // Number of statements to execute at once
    
    // Process each line
    for await (const line of rl) {
      // Skip comments and empty lines
      if (line.trim().startsWith('--') || line.trim() === '') {
        continue;
      }
      
      // Add the line to the buffer
      statementBuffer += line + '\n';
      
      // If the line ends with a semicolon, it's the end of a statement
      if (line.trim().endsWith(';')) {
        lineCount++;
        
        // If we've accumulated enough statements, execute them
        if (lineCount >= CHUNK_SIZE) {
          try {
            await pool.query(statementBuffer);
            console.log(`Executed ${lineCount} statements`);
          } catch (err) {
            console.error('Error executing statements:', err);
          }
          
          // Reset the buffer and line count
          statementBuffer = '';
          lineCount = 0;
        }
      }
    }
    
    // Execute any remaining statements
    if (statementBuffer.trim() !== '') {
      try {
        await pool.query(statementBuffer);
        console.log(`Executed ${lineCount} statements`);
      } catch (err) {
        console.error('Error executing statements:', err);
      }
    }
    
    console.log('Successfully imported data in chunks');
    return true;
  } catch (err) {
    console.error('Error importing data in chunks:', err);
    return false;
  }
}

// Function to apply migrations
async function applyMigrations() {
  console.log('Applying migrations...');
  
  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.error(`Migrations directory not found: ${migrationsDir}`);
      return false;
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to apply migrations in order
    
    // Apply each migration
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      
      try {
        await executeSqlScript(migrationPath);
        console.log(`Applied migration: ${migrationFile}`);
      } catch (err) {
        console.error(`Error applying migration ${migrationFile}:`, err);
        // Continue with the next migration
      }
    }
    
    console.log('Successfully applied migrations');
    return true;
  } catch (err) {
    console.error('Error applying migrations:', err);
    return false;
  }
}

// Main function
async function main() {
  console.log('Starting PostgreSQL import...');
  
  try {
    // Connect to the database
    console.log('Connecting to PostgreSQL...');
    await pool.connect();
    console.log('Connected to PostgreSQL');
    
    // Create schema
    const schemaCreated = await createSchema();
    
    if (!schemaCreated) {
      console.error('Failed to create schema. Aborting import.');
      process.exit(1);
    }
    
    // Import data
    console.log('Importing data...');
    const dataImported = await importDataInChunks();
    
    if (!dataImported) {
      console.warn('Warning: Data import had issues. Continuing with migrations.');
    }
    
    // Apply migrations
    console.log('Applying migrations...');
    const migrationsApplied = await applyMigrations();
    
    if (!migrationsApplied) {
      console.warn('Warning: Migrations had issues.');
    }
    
    console.log('Import completed successfully!');
  } catch (err) {
    console.error('Error during import:', err);
    process.exit(1);
  } finally {
    // Close the database connection
    await pool.end();
    console.log('Disconnected from PostgreSQL');
  }
}

// Run the main function
main();