// This script will check what positions are available in the database

import { createClient } from '@supabase/supabase-js'

// Read the Supabase URL and key from .env
const supabaseUrl = 'https://esmboovriahdhtvvxgzn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWJvb3ZyaWFoZGh0dnZ4Z3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MzAwMTgsImV4cCI6MjA2MDMwNjAxOH0.8t1o1yk8ozklE5ltv3mNV7LHKnKZe9kdNzFTd29klIA'

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPositions() {
  console.log('Checking available positions...')
  
  try {
    // Get all positions
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('*')
    
    if (positionsError) {
      console.error('Error getting positions:', positionsError)
      return
    }
    
    console.log('Available positions:', positions)
    
    // Get admin user
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, email, position_id')
      .eq('email', 'admin@example.com')
      .single()
    
    if (adminError && adminError.code !== 'PGRST116') {
      console.error('Error getting admin user:', adminError)
    } else {
      console.log('Admin user:', adminUser)
    }
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, position_id')
      .limit(5)
    
    if (usersError) {
      console.error('Error getting users:', usersError)
      return
    }
    
    console.log('Sample users:', users)
    
  } catch (err) {
    console.error('Error:', err)
  }
}

checkPositions()