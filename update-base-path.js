import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update Vite config
function updateViteConfig() {
  console.log('Updating Vite config...');
  
  const viteConfigPath = path.join(__dirname, 'vite.config.ts');
  
  if (!fs.existsSync(viteConfigPath)) {
    console.error(`Vite config file not found: ${viteConfigPath}`);
    return false;
  }
  
  let viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
  
  // Check if base is already set
  if (viteConfig.includes("base: '/crm/'")) {
    console.log('Base path already set in Vite config');
    return true;
  }
  
  // Add base path to defineConfig
  viteConfig = viteConfig.replace(
    /defineConfig\(\{/,
    "defineConfig({\n  base: '/crm/',\n"
  );
  
  fs.writeFileSync(viteConfigPath, viteConfig);
  console.log('Updated Vite config with base path');
  return true;
}

// Update router configuration
function updateRouter() {
  console.log('Updating router configuration...');
  
  const mainTsxPath = path.join(__dirname, 'src', 'main.tsx');
  
  if (!fs.existsSync(mainTsxPath)) {
    console.error(`Main TSX file not found: ${mainTsxPath}`);
    return false;
  }
  
  let mainTsx = fs.readFileSync(mainTsxPath, 'utf8');
  
  // Check if router is already configured with base path
  if (mainTsx.includes("history: createBrowserHistory({ basename: '/crm' })") || 
      mainTsx.includes("history: createWebHistory('/crm')")) {
    console.log('Base path already set in router configuration');
    return true;
  }
  
  // Update router configuration based on the pattern used
  if (mainTsx.includes('createBrowserHistory')) {
    mainTsx = mainTsx.replace(
      /createBrowserHistory\(\)/,
      "createBrowserHistory({ basename: '/crm' })"
    );
    
    mainTsx = mainTsx.replace(
      /createBrowserHistory\(\s*\{/,
      "createBrowserHistory({\n  basename: '/crm',"
    );
  } else if (mainTsx.includes('createWebHistory')) {
    mainTsx = mainTsx.replace(
      /createWebHistory\(\)/,
      "createWebHistory('/crm')"
    );
    
    mainTsx = mainTsx.replace(
      /createWebHistory\(\s*\'/,
      "createWebHistory('/crm"
    );
  } else {
    console.error('Could not find router history creation in main.tsx');
    return false;
  }
  
  fs.writeFileSync(mainTsxPath, mainTsx);
  console.log('Updated router configuration with base path');
  return true;
}

// Update asset references in index.html
function updateIndexHtml() {
  console.log('Updating asset references in index.html...');
  
  const indexHtmlPath = path.join(__dirname, 'index.html');
  
  if (!fs.existsSync(indexHtmlPath)) {
    console.error(`Index HTML file not found: ${indexHtmlPath}`);
    return false;
  }
  
  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Check if assets are already prefixed
  if (indexHtml.includes('src="/crm/') || indexHtml.includes('href="/crm/')) {
    console.log('Asset references already updated in index.html');
    return true;
  }
  
  // Update asset references
  indexHtml = indexHtml.replace(
    /(src|href)="\//g,
    '$1="/crm/'
  );
  
  fs.writeFileSync(indexHtmlPath, indexHtml);
  console.log('Updated asset references in index.html');
  return true;
}

// Create .env.production file
function createEnvProduction() {
  console.log('Creating .env.production file...');
  
  const envPath = path.join(__dirname, '.env.production');
  
  // Check if .env.production already exists
  if (fs.existsSync(envPath)) {
    console.log('.env.production file already exists');
    
    // Update BASE_URL if needed
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    if (!envContent.includes('BASE_URL=https://coveredamerican.com/crm')) {
      // Add or update BASE_URL
      if (envContent.includes('BASE_URL=')) {
        envContent = envContent.replace(
          /BASE_URL=.*/,
          'BASE_URL=https://coveredamerican.com/crm'
        );
      } else {
        envContent += '\nBASE_URL=https://coveredamerican.com/crm\n';
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('Updated BASE_URL in .env.production');
    }
    
    return true;
  }
  
  // Create new .env.production file
  const envContent = `# Production environment variables
NODE_ENV=production
BASE_URL=https://coveredamerican.com/crm

# Database connection
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=crm_db
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=your_strong_password_here

# Server settings
PORT=3000
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('Created .env.production file');
  return true;
}

// Main function
async function main() {
  console.log('Starting base path update...');
  
  const viteUpdated = updateViteConfig();
  const routerUpdated = updateRouter();
  const indexUpdated = updateIndexHtml();
  const envCreated = createEnvProduction();
  
  if (viteUpdated && routerUpdated && indexUpdated && envCreated) {
    console.log('Base path update completed successfully!');
    console.log('Your application will be served from: https://coveredamerican.com/crm');
  } else {
    console.error('Base path update completed with errors. Please check the logs above.');
  }
}

// Run the main function
main();