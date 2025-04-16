import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Agent, Position, PermissionLevel, UserAccount } from '../types/database';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const UserSettings = () => {
  const { user, updatePassword } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: userDetails, isLoading, error } = useQuery<Agent & { user_account: UserAccount }>(
    ['user', user?.id],
    async () => {
      if (!user?.id) {
        return null;
      }

      // First check if the user exists in the users table
      const { data: userExists, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (checkError) throw checkError;
      
      if (!userExists) {
        // If user doesn't exist in the users table, create a default entry
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User',
            is_active: true
          })
          .select()
          .single();

        if (createError) throw createError;
      }

      // Now get the full user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          positions (*),
          permission_levels (*),
          downline:upline_id (*)
        `)
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      // Then get the user account details
      const { data: accountData, error: accountError } = await supabase
        .from('user_accs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (accountError) throw accountError;
      
      return {
        ...userData,
        user_account: accountData || {
          display_name: userData.full_name,
          theme_preference: 'light',
          notification_preferences: {
            email: true,
            push: true,
            deals: true,
            system: true
          }
        }
      };
    },
    {
      enabled: !!user?.id,
      retry: 1,
      retryDelay: 1000,
      onError: (error: any) => {
        toast.error(`Failed to load user data: ${error.message}`);
      }
    }
  );

  const updateUser = useMutation(
    async (updates: Partial<Agent & { user_account: Partial<UserAccount> }>) => {
      if (!user?.id) {
        throw new Error('No user ID available');
      }

      const { user_account, ...userUpdates } = updates;

      // Update user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', user.id)
        .select()
        .single();

      if (userError) throw userError;

      // Check if user_account exists
      const { data: existingAccount } = await supabase
        .from('user_accs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let accountData;
      if (existingAccount) {
        // Update existing account
        const { data, error: accountError } = await supabase
          .from('user_accs')
          .update({
            ...user_account,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .select()
          .single();

        if (accountError) throw accountError;
        accountData = data;
      } else {
        // Insert new account
        const { data, error: accountError } = await supabase
          .from('user_accs')
          .insert({
            user_id: user.id,
            ...user_account,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (accountError) throw accountError;
        accountData = data;
      }

      return { ...userData, user_account: accountData };
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['user', user?.id]);
        setIsEditing(false);
        toast.success('Profile updated successfully');
      },
      onError: (error: any) => {
        toast.error(`Failed to update profile: ${error.message}`);
      }
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const updates: Record<string, any> = {
      user_account: {}
    };

    formData.forEach((value, key) => {
      if (key.startsWith('account_')) {
        const accountKey = key.replace('account_', '');
        if (value === '') {
          updates.user_account[accountKey] = null;
        } else if (accountKey === 'notification_preferences') {
          updates.user_account[accountKey] = JSON.parse(value as string);
        } else {
          updates.user_account[accountKey] = value;
        }
      } else {
        if (value === '') {
          updates[key] = null;
        } else if (key === 'annual_goal') {
          updates[key] = value ? parseFloat(value as string) : null;
        } else {
          updates[key] = value;
        }
      }
    });

    updateUser.mutate(updates);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    try {
      await updatePassword(newPassword);
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
    }
  };

  if (!user?.id) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center text-gray-600">
            <p>Please sign in to view your settings.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !userDetails) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center text-gray-600">
            <p>Unable to load user settings. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Account Settings</h2>
        </div>

        <div className="p-6">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  id="full_name"
                  defaultValue={userDetails.full_name}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="account_display_name" className="block text-sm font-medium text-gray-700">
                  Display Name
                </label>
                <input
                  type="text"
                  name="account_display_name"
                  id="account_display_name"
                  defaultValue={userDetails.user_account?.display_name || userDetails.full_name}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  defaultValue={userDetails.email}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  defaultValue={userDetails.phone || ''}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="account_theme_preference" className="block text-sm font-medium text-gray-700">
                  Theme Preference
                </label>
                <select
                  name="account_theme_preference"
                  id="account_theme_preference"
                  defaultValue={userDetails.user_account?.theme_preference || 'light'}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label htmlFor="national_producer_number" className="block text-sm font-medium text-gray-700">
                  National Producer Number
                </label>
                <input
                  type="text"
                  name="national_producer_number"
                  id="national_producer_number"
                  defaultValue={userDetails.national_producer_number || ''}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="annual_goal" className="block text-sm font-medium text-gray-700">
                  Annual Goal
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    name="annual_goal"
                    id="annual_goal"
                    defaultValue={userDetails.annual_goal || ''}
                    className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Preferences
                </label>
                <input
                  type="hidden"
                  name="account_notification_preferences"
                  value={JSON.stringify(userDetails.user_account?.notification_preferences)}
                />
                <div className="space-y-2">
                  {Object.entries(userDetails.user_account?.notification_preferences || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`notification_${key}`}
                        checked={value as boolean}
                        onChange={(e) => {
                          const newPrefs = {
                            ...userDetails.user_account?.notification_preferences,
                            [key]: e.target.checked
                          };
                          (document.querySelector('input[name="account_notification_preferences"]') as HTMLInputElement)
                            .value = JSON.stringify(newPrefs);
                        }}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`notification_${key}`} className="ml-2 block text-sm text-gray-900">
                        {key.charAt(0).toUpperCase() + key.slice(1)} Notifications
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingAgent(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
                <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{userDetails.full_name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {userDetails.user_account?.display_name || userDetails.full_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{userDetails.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Phone</dt>
                    <dd className="mt-1 text-sm text-gray-900">{userDetails.phone || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Theme Preference</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {userDetails.user_account?.theme_preference || 'Light'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">National Producer Number</dt>
                    <dd className="mt-1 text-sm text-gray-900">{userDetails.national_producer_number || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Annual Goal</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {userDetails.annual_goal ? `$${userDetails.annual_goal.toLocaleString()}` : 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Position</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {(userDetails.positions as Position)?.name || 'Not assigned'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Permission Level</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {(userDetails.permission_levels as PermissionLevel)?.name || 'Not assigned'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Downline</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {(userDetails.downline as Agent)?.full_name || 'No downline'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-500">Notification Preferences</h4>
                  <ul className="mt-2 divide-y divide-gray-200">
                    {Object.entries(userDetails.user_account?.notification_preferences || {}).map(([key, value]) => (
                      <li key={key} className="py-2 flex justify-between">
                        <span className="text-sm text-gray-900">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                        <span className={`text-sm ${value ? 'text-green-600' : 'text-red-600'}`}>
                          {value ? 'Enabled' : 'Disabled'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          )}

          {/* Password Change Form */}
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
            {showPasswordForm ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full pr-10 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <div className="mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Change Password
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;