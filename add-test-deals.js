import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import path from 'path';

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

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Test agent ID
const testAgentId = 'test-agent-id';

// Sample carriers and products
const carriers = [
  { name: 'Acme Insurance', advance_rate: 0.75 },
  { name: 'Global Coverage', advance_rate: 0.8 },
  { name: 'Secure Life', advance_rate: 0.7 }
];

const products = [
  { name: 'Auto Insurance', type: 'auto' },
  { name: 'Home Insurance', type: 'home' },
  { name: 'Life Insurance', type: 'life' }
];

// Sample client names
const clientNames = [
  'John Smith',
  'Jane Doe',
  'Robert Johnson',
  'Emily Williams',
  'Michael Brown'
];

// Sample statuses
const statuses = ['Pending', 'Approved', 'Rejected'];

// Function to generate a random date within the last 30 days
const getRandomDate = () => {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString();
};

// Function to generate a random number between min and max
const getRandomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Function to generate a random policy number
const getRandomPolicyNumber = () => {
  return `POL-${Math.floor(Math.random() * 1000000)}`;
};

// Function to generate a random app number
const getRandomAppNumber = () => {
  return `APP-${Math.floor(Math.random() * 1000000)}`;
};

// Function to generate a random phone number
const getRandomPhoneNumber = () => {
  return `(${getRandomNumber(100, 999)}) ${getRandomNumber(100, 999)}-${getRandomNumber(1000, 9999)}`;
};

// Function to add carriers
const addCarriers = async () => {
  console.log('Adding carriers...');
  const carrierIds = [];
  
  for (const carrier of carriers) {
    const { data, error } = await supabase
      .from('carriers')
      .insert({
        name: carrier.name,
        advance_rate: carrier.advance_rate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id');
    
    if (error) {
      console.error('Error adding carrier:', error);
    } else {
      console.log(`Added carrier: ${carrier.name}`);
      carrierIds.push(data[0].id);
    }
  }
  
  return carrierIds;
};

// Function to add products
const addProducts = async (carrierIds) => {
  console.log('Adding products...');
  const productIds = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const carrierId = carrierIds[i % carrierIds.length];
    
    const { data, error } = await supabase
      .from('products')
      .insert({
        carrier_id: carrierId,
        name: product.name,
        type: product.type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id');
    
    if (error) {
      console.error('Error adding product:', error);
    } else {
      console.log(`Added product: ${product.name}`);
      productIds.push(data[0].id);
    }
  }
  
  return productIds;
};

// Function to add deals
const addDeals = async (carrierIds, productIds) => {
  console.log('Adding deals...');
  
  for (let i = 0; i < 10; i++) {
    const carrierId = carrierIds[i % carrierIds.length];
    const productId = productIds[i % productIds.length];
    const clientName = clientNames[i % clientNames.length];
    const status = statuses[i % statuses.length];
    const fromReferral = i % 2 === 0;
    const submittedAt = getRandomDate();
    const annualPremium = getRandomNumber(1000, 5000);
    
    const { error } = await supabase
      .from('deals')
      .insert({
        agent_id: testAgentId,
        carrier_id: carrierId,
        product_id: productId,
        client_name: clientName,
        client_phone: getRandomPhoneNumber(),
        annual_premium: annualPremium,
        monthly_premium: Math.round(annualPremium / 12),
        policy_number: getRandomPolicyNumber(),
        app_number: getRandomAppNumber(),
        status: status,
        from_referral: fromReferral,
        submitted_at: submittedAt,
        created_at: submittedAt,
        updated_at: submittedAt
      });
    
    if (error) {
      console.error('Error adding deal:', error);
    } else {
      console.log(`Added deal for client: ${clientName}`);
    }
  }
};

// Main function
const main = async () => {
  try {
    // Add carriers
    const carrierIds = await addCarriers();
    
    // Add products
    const productIds = await addProducts(carrierIds);
    
    // Add deals
    await addDeals(carrierIds, productIds);
    
    console.log('Done adding test data!');
  } catch (error) {
    console.error('Error:', error);
  }
};

// Run the main function
main();