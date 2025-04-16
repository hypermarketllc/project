// Script to fix issue with deleted user still existing in auth.users table
// This script uses the Supabase Admin API and requires an admin API key
// Run this script with Node.js: node fix_deleted_user.js

require('dotenv').config();
const fetch = require('node-fetch');

// Replace these with your Supabase project details
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // This is the service_role key, not the anon key

// The email of the user to fix
const USER_EMAIL = 'adam@americancoveragecenter.com';

// Function to check if the user exists in auth.users
async function checkUserExists() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_user_exists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        p_email: USER_EMAIL
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('User exists check result:', result);
    return result;
  } catch (error) {
    console.error('Error checking if user exists:', error);
    throw error;
  }
}

// Function to update the user's email to allow reuse
async function updateUserEmail() {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const newEmail = `deleted_${timestamp}_${USER_EMAIL}`;
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        p_current_email: USER_EMAIL,
        p_new_email: newEmail
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Email update result:', result);
    return result;
  } catch (error) {
    console.error('Error updating user email:', error);
    throw error;
  }
}

// Function to delete the user from auth.users
async function deleteAuthUser() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_auth_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        p_email: USER_EMAIL
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Auth user deletion result:', result);
    return result;
  } catch (error) {
    console.error('Error deleting auth user:', error);
    throw error;
  }
}

// Function to delete the user from the application database
async function deleteAppUser() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(USER_EMAIL)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    console.log('App user deletion result:', response.status === 204 ? 'Success' : 'No user found');
    return response.status === 204;
  } catch (error) {
    console.error('Error deleting app user:', error);
    throw error;
  }
}

// Main function to fix the user issue
async function fixDeletedUser() {
  try {
    console.log(`Attempting to fix user with email: ${USER_EMAIL}`);
    
    // First, check if the user exists
    const exists = await checkUserExists();
    
    if (exists) {
      console.log('User exists in auth.users table. Choose an option:');
      console.log('1. Update the email to allow reuse (safer)');
      console.log('2. Delete the user from auth.users (destructive)');
      
      // For this script, we'll default to option 1 (update email)
      // In a real scenario, you might want to prompt the user for input
      const option = 1;
      
      if (option === 1) {
        console.log('Updating user email...');
        await updateUserEmail();
        console.log(`User email updated. You can now create a new account with ${USER_EMAIL}`);
      } else if (option === 2) {
        console.log('Deleting user from auth.users...');
        await deleteAuthUser();
        console.log(`User deleted from auth.users. You can now create a new account with ${USER_EMAIL}`);
      }
    } else {
      console.log('User does not exist in auth.users table.');
      
      // Check if the user exists in the application database
      console.log('Checking if user exists in application database...');
      await deleteAppUser();
      console.log('Any application user records have been deleted.');
    }
    
    console.log('Process completed. Try creating the account again.');
  } catch (error) {
    console.error('Error fixing deleted user:', error);
  }
}

// First, we need to create the necessary functions in the database
async function createHelperFunctions() {
  try {
    // Create function to check if a user exists
    const checkUserSql = `
    CREATE OR REPLACE FUNCTION check_user_exists(p_email TEXT)
    RETURNS BOOLEAN
    SECURITY DEFINER
    AS $$
    DECLARE
      user_exists BOOLEAN;
    BEGIN
      SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = p_email) INTO user_exists;
      RETURN user_exists;
    END;
    $$ LANGUAGE plpgsql;
    `;

    // Create function to update a user's email
    const updateEmailSql = `
    CREATE OR REPLACE FUNCTION update_user_email(p_current_email TEXT, p_new_email TEXT)
    RETURNS BOOLEAN
    SECURITY DEFINER
    AS $$
    DECLARE
      affected_rows INTEGER;
    BEGIN
      UPDATE auth.users SET email = p_new_email WHERE email = p_current_email;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      RETURN affected_rows > 0;
    END;
    $$ LANGUAGE plpgsql;
    `;

    // Create function to delete a user from auth.users
    const deleteUserSql = `
    CREATE OR REPLACE FUNCTION delete_auth_user(p_email TEXT)
    RETURNS BOOLEAN
    SECURITY DEFINER
    AS $$
    DECLARE
      affected_rows INTEGER;
    BEGIN
      DELETE FROM auth.users WHERE email = p_email;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      RETURN affected_rows > 0;
    END;
    $$ LANGUAGE plpgsql;
    `;

    // Execute the SQL to create the functions
    const response = await fetch(`${SUPABASE_URL}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        query: checkUserSql + updateEmailSql + deleteUserSql
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    console.log('Helper functions created successfully');
  } catch (error) {
    console.error('Error creating helper functions:', error);
    throw error;
  }
}

// Run the script
async function run() {
  try {
    // First create the helper functions
    await createHelperFunctions();
    
    // Then fix the user issue
    await fixDeletedUser();
  } catch (error) {
    console.error('Script execution failed:', error);
  }
}

run();