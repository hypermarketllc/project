// This script will ensure only admin@americancoveragecenter.com has the Owner position
// and the permission to change positions of other agents

import { createClient } from '@supabase/supabase-js'

// Read the Supabase URL and key from .env
const supabaseUrl = 'https://esmboovriahdhtvvxgzn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWJvb3ZyaWFoZGh0dnZ4Z3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MzAwMTgsImV4cCI6MjA2MDMwNjAxOH0.8t1o1yk8ozklE5ltv3mNV7LHKnKZe9kdNzFTd29klIA'

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

async function fixAdminPermissions() {
  console.log('Fixing admin permissions...')
  
  try {
    // Get position IDs
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('id, name, level')
    
    if (positionsError) {
      console.error('Error getting positions:', positionsError)
      return
    }
    
    // Find the Owner and Admin position IDs
    const ownerPosition = positions.find(p => p.name === 'Owner')
    const adminPosition = positions.find(p => p.name === 'Admin')
    
    if (!ownerPosition || !adminPosition) {
      console.error('Could not find Owner or Admin position')
      return
    }
    
    console.log('Owner position:', ownerPosition)
    console.log('Admin position:', adminPosition)
    
    // Check if admin@americancoveragecenter.com exists and has the Owner position
    const { data: mainAdmin, error: mainAdminError } = await supabase
      .from('users')
      .select('id, email, position_id')
      .eq('email', 'admin@americancoveragecenter.com')
      .single()
    
    if (mainAdminError && mainAdminError.code !== 'PGRST116') {
      console.error('Error getting main admin user:', mainAdminError)
      return
    }
    
    // Update admin@americancoveragecenter.com to have the Owner position
    if (mainAdmin) {
      console.log('Found main admin user:', mainAdmin)
      
      if (mainAdmin.position_id !== ownerPosition.id) {
        const { error: updateMainAdminError } = await supabase
          .from('users')
          .update({ position_id: ownerPosition.id })
          .eq('id', mainAdmin.id)
        
        if (updateMainAdminError) {
          console.error('Error updating main admin user:', updateMainAdminError)
          return
        }
        
        console.log('Updated admin@americancoveragecenter.com to have Owner position')
      } else {
        console.log('admin@americancoveragecenter.com already has Owner position')
      }
    } else {
      console.log('admin@americancoveragecenter.com not found')
    }
    
    // Update admin@example.com to have the Admin position (not Owner)
    const { data: secondaryAdmin, error: secondaryAdminError } = await supabase
      .from('users')
      .select('id, email, position_id')
      .eq('email', 'admin@example.com')
      .single()
    
    if (secondaryAdminError) {
      console.error('Error getting secondary admin user:', secondaryAdminError)
      return
    }
    
    console.log('Found secondary admin user:', secondaryAdmin)
    
    if (secondaryAdmin.position_id === ownerPosition.id) {
      const { error: updateSecondaryAdminError } = await supabase
        .from('users')
        .update({ position_id: adminPosition.id })
        .eq('id', secondaryAdmin.id)
      
      if (updateSecondaryAdminError) {
        console.error('Error updating secondary admin user:', updateSecondaryAdminError)
        return
      }
      
      console.log('Updated admin@example.com to have Admin position (not Owner)')
    } else {
      console.log('admin@example.com already does not have Owner position')
    }
    
    // Verify the changes
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, position_id')
      .in('email', ['admin@americancoveragecenter.com', 'admin@example.com'])
    
    if (usersError) {
      console.error('Error getting users:', usersError)
      return
    }
    
    console.log('Updated users:', users)
    
    console.log('Fix completed! Only admin@americancoveragecenter.com should now have permission to change agent positions.')
  } catch (err) {
    console.error('Error:', err)
  }
}

fixAdminPermissions()