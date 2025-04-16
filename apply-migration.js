import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the Supabase URL and key from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env file');
  process.exit(1);
}

// Get the migration file path from command line arguments or use the latest migration
let migrationFile = process.argv[2];

if (!migrationFile) {
  // Find the latest migration file
  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).sort();
  
  if (migrationFiles.length === 0) {
    console.error('Error: No migration files found');
    process.exit(1);
  }
  
  migrationFile = path.join(migrationsDir, migrationFiles[migrationFiles.length - 1]);
} else {
  // Check if the file exists
  if (!fs.existsSync(migrationFile)) {
    console.error(`Error: Migration file ${migrationFile} not found`);
    process.exit(1);
  }
}

console.log(`Applying migration: ${migrationFile}`);

// Read the migration file
const migration = fs.readFileSync(migrationFile, 'utf8');

// Create a temporary SQL file with the migration
const tempFile = path.join(__dirname, 'temp-migration.sql');
fs.writeFileSync(tempFile, migration);

try {
  // Apply the migration using psql
  const command = `psql "${supabaseUrl.replace('https://', '')}" -U postgres -f "${tempFile}"`;
  console.log(`Executing: ${command}`);
  
  execSync(command, {
    env: {
      ...process.env,
      PGPASSWORD: supabaseKey
    },
    stdio: 'inherit'
  });
  
  console.log('Migration applied successfully');
} catch (error) {
  console.error('Error applying migration:', error.message);
} finally {
  // Clean up the temporary file
  fs.unlinkSync(tempFile);
}