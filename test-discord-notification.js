const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDiscordNotification() {
  console.log('Testing Discord notification...');
  
  try {
    // First, check if Discord integration is active
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'discord')
      .eq('name', 'Discord Webhook')
      .single();
    
    if (integrationError) {
      console.error('Error fetching Discord integration:', integrationError);
      return;
    }
    
    if (!integration) {
      console.error('Discord integration not found. Please run apply-discord-integration.js first.');
      return;
    }
    
    if (!integration.is_active) {
      console.log('⚠️ Discord integration is not active. Activating it for this test...');
      
      // Temporarily activate the integration
      const { error: activateError } = await supabase
        .from('integrations')
        .update({ is_active: true })
        .eq('id', integration.id);
      
      if (activateError) {
        console.error('Error activating Discord integration:', activateError);
        return;
      }
      
      console.log('✅ Discord integration activated for testing');
    }
    
    // Check if webhook URL is configured
    if (!integration.config.webhook_url) {
      console.error('Discord webhook URL is not configured. Please configure it in the Integrations section of the Configuration module.');
      return;
    }
    
    console.log('Creating a test deal to trigger Discord notification...');
    
    // Get a random agent
    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select('id, full_name')
      .limit(1);
    
    if (agentsError || !agents || agents.length === 0) {
      console.error('Error fetching agent:', agentsError || 'No agents found');
      return;
    }
    
    const agent = agents[0];
    
    // Get a random carrier
    const { data: carriers, error: carriersError } = await supabase
      .from('carriers')
      .select('id, name')
      .limit(1);
    
    if (carriersError || !carriers || carriers.length === 0) {
      console.error('Error fetching carrier:', carriersError || 'No carriers found');
      return;
    }
    
    const carrier = carriers[0];
    
    // Get a random product for the carrier
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name')
      .eq('carrier_id', carrier.id)
      .limit(1);
    
    if (productsError || !products || products.length === 0) {
      console.error('Error fetching product:', productsError || 'No products found for carrier');
      return;
    }
    
    const product = products[0];
    
    // Create a test deal
    const testDeal = {
      agent_id: agent.id,
      carrier_id: carrier.id,
      product_id: product.id,
      client_name: 'Test Discord Notification',
      client_phone: '555-123-4567',
      client_email: 'test@example.com',
      monthly_premium: 100,
      annual_premium: 1200,
      status: 'pending',
      notes: 'This is a test deal to verify Discord notifications'
    };
    
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert(testDeal)
      .select()
      .single();
    
    if (dealError) {
      console.error('Error creating test deal:', dealError);
      return;
    }
    
    console.log('✅ Test deal created successfully:', deal);
    console.log('A Discord notification should have been sent to your webhook URL.');
    console.log('Check your Discord channel to verify the notification was received.');
    
    // If we temporarily activated the integration, deactivate it
    if (!integration.is_active) {
      console.log('Deactivating Discord integration...');
      
      const { error: deactivateError } = await supabase
        .from('integrations')
        .update({ is_active: false })
        .eq('id', integration.id);
      
      if (deactivateError) {
        console.error('Error deactivating Discord integration:', deactivateError);
      } else {
        console.log('✅ Discord integration deactivated');
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testDiscordNotification();