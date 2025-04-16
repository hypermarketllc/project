// This script will check what position admin@example.com has

import { createClient } from '@supabase/supabase-js'

// Read the Supabase URL and key from .env
const supabaseUrl = 'https://esmboovriahdhtvvxgzn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWJvb3ZyaWFoZGh0dnZ4Z3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MzAwMTgsImV4cCI6MjA2MDMwNjAxOH0.8t1o1yk8ozklE5ltv3mNV7LHKnKZe9kdNzFTd29klIA'

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAdminPosition() {
  console.log('Checking admin@example.com position...')
  
  try {
    // Get admin@example.com user with position details
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select(`
        id, 
        email, 
        position_id,
        positions:position_id (
          id,
          name,
          level,
          description
        )
      `)
      .eq('email', 'admin@example.com')
      .single()
    
    if (adminError) {
      console.error('Error getting admin user:', adminError)
      return
    }
    
    console.log('Admin user with position details:', adminUser)
    
  } catch (err) {
    console.error('Error:', err)
  }
}

checkAdminPosition()