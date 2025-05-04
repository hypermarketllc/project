import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Commission Logic Test Script (Direct Method)');
console.log('=========================================\n');

// Ask for Supabase credentials
rl.question('Enter your Supabase URL: ', (supabaseUrl) => {
  rl.question('Enter your Supabase service role key: ', async (supabaseKey) => {
    try {
      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Function to get carriers
      async function getCarriers() {
        const { data, error } = await supabase
          .from('carriers')
          .select('*')
          .order('name');

        if (error) {
          console.error('Error fetching carriers:', error);
          return [];
        }

        return data;
      }

      // Function to get products
      async function getProducts() {
        const { data, error } = await supabase
          .from('products')
          .select('*, carriers(name)')
          .order('name');

        if (error) {
          console.error('Error fetching products:', error);
          return [];
        }

        return data;
      }

      // Function to get agents
      async function getAgents() {
        const { data, error } = await supabase
          .from('agents')
          .select('*, positions(name)')
          .order('full_name');

        if (error) {
          console.error('Error fetching agents:', error);
          return [];
        }

        return data;
      }

      // Function to create a test deal
      async function createTestDeal(carrierId, productId, agentId, monthlyPremium, annualPremium) {
        const { data, error } = await supabase
          .from('deals')
          .insert({
            carrier_id: carrierId,
            product_id: productId,
            agent_id: agentId,
            client_name: 'Test Client',
            monthly_premium: monthlyPremium,
            annual_premium: annualPremium,
            status: 'active'
          })
          .select();

        if (error) {
          console.error('Error creating deal:', error);
          return null;
        }

        return data[0];
      }

      // Function to get commissions for a deal
      async function getCommissions(dealId) {
        const { data, error } = await supabase
          .from('commissions')
          .select('*, agents(full_name), positions(name)')
          .eq('deal_id', dealId)
          .order('payment_date');

        if (error) {
          console.error('Error fetching commissions:', error);
          return [];
        }

        return data;
      }

      // Function to update deal status
      async function updateDealStatus(dealId, status) {
        const { data, error } = await supabase
          .from('deals')
          .update({ status })
          .eq('id', dealId)
          .select();

        if (error) {
          console.error('Error updating deal status:', error);
          return null;
        }

        return data[0];
      }

      // Function to manually calculate commissions
      async function manuallyCalculateCommissions(dealId) {
        try {
          // Execute the calculate_commissions function
          const { error } = await supabase.rpc('calculate_commissions', { p_deal_id: dealId });
          
          if (error) {
            console.error('Error calculating commissions:', error);
            return false;
          }
          
          return true;
        } catch (error) {
          console.error('Error calculating commissions:', error);
          return false;
        }
      }

      // Function to manually process chargeback
      async function manuallyProcessChargeback(dealId) {
        try {
          // Execute the process_chargeback function
          const { error } = await supabase.rpc('process_chargeback', { p_deal_id: dealId });
          
          if (error) {
            console.error('Error processing chargeback:', error);
            return false;
          }
          
          return true;
        } catch (error) {
          console.error('Error processing chargeback:', error);
          return false;
        }
      }

      // Function to manually reinstate policy
      async function manuallyReinstatePolicy(dealId) {
        try {
          // Execute the reinstate_policy function
          const { error } = await supabase.rpc('reinstate_policy', { p_deal_id: dealId });
          
          if (error) {
            console.error('Error reinstating policy:', error);
            return false;
          }
          
          return true;
        } catch (error) {
          console.error('Error reinstating policy:', error);
          return false;
        }
      }

      // Get carriers
      const carriers = await getCarriers();
      if (carriers.length === 0) {
        console.error('No carriers found. Please create carriers first.');
        rl.close();
        return;
      }

      // Update carriers with payment type and advance period if needed
      for (const carrier of carriers) {
        if (!carrier.payment_type) {
          console.log(`Updating carrier ${carrier.name} with default payment type and advance period...`);
          
          const { error } = await supabase
            .from('carriers')
            .update({
              payment_type: 'advance',
              advance_period_months: 9
            })
            .eq('id', carrier.id);
          
          if (error) {
            console.error(`Error updating carrier ${carrier.name}:`, error);
          }
        }
      }

      // Refresh carriers
      const updatedCarriers = await getCarriers();

      console.log('Available carriers:');
      updatedCarriers.forEach((carrier, index) => {
        console.log(`${index + 1}. ${carrier.name} (${carrier.payment_type || 'advance'}, ${carrier.advance_rate || 75}%, ${carrier.advance_period_months || 9} months)`);
      });

      // Select carrier
      rl.question('\nSelect a carrier (number): ', async (carrierIndex) => {
        const selectedCarrier = updatedCarriers[parseInt(carrierIndex) - 1];
        if (!selectedCarrier) {
          console.error('Invalid carrier selection.');
          rl.close();
          return;
        }

        // Get products for the selected carrier
        const products = await getProducts();
        const carrierProducts = products.filter(p => p.carrier_id === selectedCarrier.id);
        if (carrierProducts.length === 0) {
          console.error('No products found for the selected carrier. Please create products first.');
          rl.close();
          return;
        }

        console.log('\nAvailable products:');
        carrierProducts.forEach((product, index) => {
          console.log(`${index + 1}. ${product.name}`);
        });

        // Select product
        rl.question('\nSelect a product (number): ', async (productIndex) => {
          const selectedProduct = carrierProducts[parseInt(productIndex) - 1];
          if (!selectedProduct) {
            console.error('Invalid product selection.');
            rl.close();
            return;
          }

          // Get agents
          const agents = await getAgents();
          if (agents.length === 0) {
            console.error('No agents found. Please create agents first.');
            rl.close();
            return;
          }

          // Ensure agents have positions
          for (const agent of agents) {
            if (!agent.position_id) {
              console.log(`Updating agent ${agent.full_name} with Agent position...`);
              
              // Get Agent position ID
              const { data: positions, error: posError } = await supabase
                .from('positions')
                .select('id')
                .eq('name', 'Agent')
                .limit(1);
              
              if (posError || !positions || positions.length === 0) {
                console.error('Error getting Agent position:', posError);
                continue;
              }
              
              const agentPositionId = positions[0].id;
              
              // Update agent
              const { error } = await supabase
                .from('agents')
                .update({ position_id: agentPositionId })
                .eq('id', agent.id);
              
              if (error) {
                console.error(`Error updating agent ${agent.full_name}:`, error);
              }
            }
          }

          // Refresh agents
          const updatedAgents = await getAgents();

          console.log('\nAvailable agents:');
          updatedAgents.forEach((agent, index) => {
            console.log(`${index + 1}. ${agent.full_name} (${agent.positions?.name || 'No position'})`);
          });

          // Select agent
          rl.question('\nSelect an agent (number): ', async (agentIndex) => {
            const selectedAgent = updatedAgents[parseInt(agentIndex) - 1];
            if (!selectedAgent) {
              console.error('Invalid agent selection.');
              rl.close();
              return;
            }

            // Enter premium amounts
            rl.question('\nEnter monthly premium: ', async (monthlyPremium) => {
              rl.question('Enter annual premium: ', async (annualPremium) => {
                console.log('\nCreating test deal...');
                
                // Create test deal
                const deal = await createTestDeal(
                  selectedCarrier.id,
                  selectedProduct.id,
                  selectedAgent.id,
                  parseFloat(monthlyPremium),
                  parseFloat(annualPremium)
                );

                if (!deal) {
                  console.error('Failed to create test deal.');
                  rl.close();
                  return;
                }

                console.log(`Deal created with ID: ${deal.id}`);

                // Manually calculate commissions if needed
                console.log('Calculating commissions...');
                await manuallyCalculateCommissions(deal.id);

                // Get commissions
                const commissions = await getCommissions(deal.id);
                
                console.log('\nCommissions generated:');
                commissions.forEach(commission => {
                  console.log(`${commission.agents?.full_name || 'Unknown'} (${commission.positions?.name || 'Unknown'}): $${commission.amount.toFixed(2)} - ${commission.commission_type} - ${commission.payment_date} - ${commission.status}`);
                });

                // Ask if user wants to test lapse
                rl.question('\nDo you want to test policy lapse? (y/n): ', async (testLapse) => {
                  if (testLapse.toLowerCase() === 'y') {
                    console.log('\nUpdating deal status to lapsed...');
                    
                    // Update deal status to lapsed
                    const updatedDeal = await updateDealStatus(deal.id, 'lapsed');
                    
                    if (!updatedDeal) {
                      console.error('Failed to update deal status.');
                      rl.close();
                      return;
                    }
                    
                    console.log('Deal status updated to lapsed.');
                    
                    // Manually process chargeback if needed
                    console.log('Processing chargeback...');
                    await manuallyProcessChargeback(deal.id);
                    
                    // Get updated commissions
                    const updatedCommissions = await getCommissions(deal.id);
                    
                    console.log('\nUpdated commissions:');
                    updatedCommissions.forEach(commission => {
                      console.log(`${commission.agents?.full_name || 'Unknown'} (${commission.positions?.name || 'Unknown'}): $${commission.amount.toFixed(2)} - ${commission.commission_type} - ${commission.is_chargeback ? 'CHARGEBACK' : commission.status} - ${commission.payment_date}`);
                    });
                    
                    // Ask if user wants to test reinstatement
                    rl.question('\nDo you want to test policy reinstatement? (y/n): ', async (testReinstate) => {
                      if (testReinstate.toLowerCase() === 'y') {
                        console.log('\nUpdating deal status to active...');
                        
                        // Update deal status to active
                        const reinstatedDeal = await updateDealStatus(deal.id, 'active');
                        
                        if (!reinstatedDeal) {
                          console.error('Failed to update deal status.');
                          rl.close();
                          return;
                        }
                        
                        console.log('Deal status updated to active.');
                        
                        // Manually reinstate policy if needed
                        console.log('Reinstating policy...');
                        await manuallyReinstatePolicy(deal.id);
                        
                        // Get updated commissions
                        const reinstatedCommissions = await getCommissions(deal.id);
                        
                        console.log('\nReinstated commissions:');
                        reinstatedCommissions.forEach(commission => {
                          console.log(`${commission.agents?.full_name || 'Unknown'} (${commission.positions?.name || 'Unknown'}): $${commission.amount.toFixed(2)} - ${commission.commission_type} - ${commission.is_chargeback ? 'CHARGEBACK' : commission.status} - ${commission.payment_date}`);
                        });
                        
                        rl.close();
                      } else {
                        rl.close();
                      }
                    });
                  } else {
                    rl.close();
                  }
                });
              });
            });
          });
        });
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      rl.close();
    }
  });
});