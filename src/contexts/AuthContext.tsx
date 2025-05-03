import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  logout: () => Promise<any>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthContext - Initializing");
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("AuthContext - Initial session:", session);
      setSession(session);
      setUser(session?.user ?? null);
      console.log("AuthContext - Initial user set:", session?.user ?? null);
      setLoading(false);
    }).catch(error => {
      console.error("AuthContext - Error getting session:", error);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("AuthContext - Auth state changed:", _event, session);
      setSession(session);
      setUser(session?.user ?? null);
      console.log("AuthContext - User updated:", session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log("AuthContext - Unsubscribing");
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Submitting login form:', { email });
      
      // Special case for test accounts
      if (email === 'agent@example.com' && password === 'Agent123!') {
        console.log('Using test agent account');
        
        // Create a mock user and session for the test account that matches the User type
        const mockUser = {
          id: 'test-agent-id',
          email: 'agent@example.com',
          user_metadata: { full_name: 'Test Agent' },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          role: 'authenticated',
          updated_at: new Date().toISOString(),
          email_confirmed_at: new Date().toISOString(),
          phone: '',
          confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          identities: []
        } as User;
        
        // Create a mock session that matches the Session type
        const mockSession = {
          access_token: 'mock-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user: mockUser,
          expires_at: Math.floor(Date.now() / 1000) + 3600
        } as Session;
        
        // Update state
        setUser(mockUser);
        setSession(mockSession);
        
        return {
          data: { user: mockUser, session: mockSession },
          error: null
        };
      }
      
      // Regular authentication flow for other users
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;

      if (data.user) {
        // First check if user exists in users table
        const { data: existingUser, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (userError && userError.code !== 'PGRST116') { // PGRST116 means no rows returned
          throw userError;
        }

        // Create or update user record
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata.full_name || email.split('@')[0],
            is_active: true,
            updated_at: new Date().toISOString()
          });

        if (upsertError) throw upsertError;

        // Check if user account exists
        const { data: existingAccount } = await supabase
          .from('user_accs')
          .select('id')
          .eq('user_id', data.user.id)
          .single();

        // Only create user account if it doesn't exist
        if (!existingAccount) {
          const { error: accountError } = await supabase
            .from('user_accs')
            .insert({
              user_id: data.user.id,
              display_name: data.user.user_metadata.full_name || email.split('@')[0],
              theme_preference: 'light',
              notification_preferences: {
                email: true,
                push: true,
                deals: true,
                system: true
              }
            });

          if (accountError) {
            console.error('Error creating user account:', accountError);
          }
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error('An unexpected error occurred')
      };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: { full_name: fullName.trim() }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Get the agent position ID (level 1)
        const { data: agentPosition, error: positionError } = await supabase
          .from('positions')
          .select('id')
          .eq('level', 1)
          .single();
          
        if (positionError) {
          console.error('Error getting agent position:', positionError);
        }
        
        // Create user record with position_id set to agent position
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName.trim(),
            is_active: true,
            position_id: agentPosition?.id // Set position_id to agent position
          });

        if (userError) {
          console.error('Error creating user record:', userError);
        }

        // Create user account
        const { error: accountError } = await supabase
          .from('user_accs')
          .insert({
            user_id: data.user.id,
            display_name: fullName.trim(),
            theme_preference: 'light',
            notification_preferences: {
              email: true,
              push: true,
              deals: true,
              system: true
            }
          });

        if (accountError) {
          console.error('Error creating user account:', accountError);
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error('An unexpected error occurred')
      };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Error logging out');
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    logout,
    isAuthenticated: !!session?.user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};