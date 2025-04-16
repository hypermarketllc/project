// This script will fix the position levels and assign the Owner position to the admin user

import { createClient } from '@supabase/supabase-js'

// Read the Supabase URL and key from .env
const supabaseUrl = 'https://esmboovriahdhtvvxgzn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWJvb3ZyaWFoZGh0dnZ4Z3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MzAwMTgsImV4cCI6MjA2MDMwNjAxOH0.8t1o1yk8ozklE5ltv3mNV7LHKnKZe9kdNzFTd29klIA'

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

async function fixPositionLevels() {
  console.log('Fixing position levels...')
  
  try {
    // Update position levels
    const positionUpdates = [
      { name: 'Owner', level: 5 },
      { name: 'Admin', level: 4 },
      { name: 'Manager', level: 3 },
      { name: 'Senior Agent', level: 2 },
      { name: 'Agent', level: 1 }
    ]
    
    for (const position of positionUpdates) {
      const { data, error } = await supabase
        .from('positions')
        .update({ level: position.level })
        .eq('name', position.name)
      
      if (error) {
        console.error(`Error updating ${position.name} position:`, error)
      } else {
        console.log(`Updated ${position.name} position to level ${position.level}`)
      }
    }
    
    // Get the Owner position ID
    const { data: ownerPosition, error: ownerError } = await supabase
      .from('positions')
      .select('id')
      .eq('name', 'Owner')
      .single()
    
    if (ownerError) {
      console.error('Error getting Owner position:', ownerError)
      return
    }
    
    // Update admin@example.com to have the Owner position
    const { data: updateResult, error: updateError } = await supabase
      .from('users')
      .update({ position_id: ownerPosition.id })
      .eq('email', 'admin@example.com')
    
    if (updateError) {
      console.error('Error updating admin user:', updateError)
    } else {
      console.log('Updated admin@example.com to have Owner position')
    }
    
    // Verify the changes
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('*')
      .order('level', { ascending: false })
    
    if (positionsError) {
      console.error('Error getting positions:', positionsError)
    } else {
      console.log('Updated positions:', positions)
    }
    
    // Verify admin user
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, email, position_id')
      .eq('email', 'admin@example.com')
      .single()
    
    if (adminError) {
      console.error('Error getting admin user:', adminError)
    } else {
      console.log('Updated admin user:', adminUser)
    }
    
    console.log('Fix completed! The owner account should now be able to change agent positions.')
  } catch (err) {
    console.error('Error:', err)
  }
}

fixPositionLevels()