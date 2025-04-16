# MyAgentView CRM Implementation Guide

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Design System](#design-system)
4. [Database Schema](#database-schema)
5. [Authentication System](#authentication-system)
6. [Dashboard Implementation](#dashboard-implementation)
7. [Post a Deal Module](#post-a-deal-module)
8. [Agents Module](#agents-module)
9. [Book of Business Module](#book-of-business-module)
10. [Scoreboard Module](#scoreboard-module)
11. [Configuration Module](#configuration-module)
12. [Discord Integration](#discord-integration)
13. [Deployment](#deployment)
14. [Error Handling](#error-handling)
15. [Testing Strategy](#testing-strategy)
16. [Future Enhancements](#future-enhancements)

## Project Overview

MyAgentView is a comprehensive CRM system designed specifically for final expense insurance agencies. The platform enables insurance agents to post deals, track commissions, manage carrier relationships, and organize agency hierarchy with downlines. It includes robust analytics, role-based permissions, and external integrations like Discord notifications.

**Core Features:**
- User management with role-based permissions
- Deal submission and tracking
- Commission calculation and distribution based on position hierarchy
- Book of business management
- Agent performance analytics and scoreboard
- Carrier and product configuration
- Discord webhook integration for deal notifications

## Technology Stack

### Frontend
- **Framework:** React.js with TypeScript
- **State Management:** React Context API + React Query for server state
- **Styling:** Tailwind CSS with a custom design system
- **Component Library:** Headless UI for accessible base components
- **Forms:** React Hook Form for form state management
- **Validation:** Zod for schema validation
- **Charts:** Recharts for data visualization
- **Animations:** Framer Motion for UI animations

### Backend (Supabase)
- **Authentication:** Supabase Auth
- **Database:** PostgreSQL through Supabase
- **Realtime:** Supabase Realtime for live updates
- **Storage:** Supabase Storage for file storage
- **Functions:** Supabase Edge Functions for backend logic
- **Webhooks:** Discord integration using webhooks

### DevOps
- **Version Control:** Git (GitHub)
- **CI/CD:** GitHub Actions for continuous deployment
- **Hosting:** Vercel for the frontend, Supabase for the backend
- **Analytics:** Plausible for privacy-focused analytics

## Design System

### Color Palette

Create a modern, professional color scheme that conveys trust and reliability while remaining visually engaging.

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary colors
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // Main primary color
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Secondary accent
        secondary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // Main secondary color
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Neutral colors
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Success, warning and error states
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      }
    }
  }
}
```

### Typography

Use a clean, modern type system that's easy to read and professional:

```javascript
// tailwind.config.js - continued
module.exports = {
  theme: {
    extend: {
      // ...colors
      fontFamily: {
        sans: ['Inter var', 'system-ui', 'sans-serif'],
        display: ['Lexend', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
    }
  }
}
```

### Component Design

Create a consistent, modern component library. Some key components:

1. **Buttons:**
   - Primary, secondary, and tertiary variants
   - Sizes: small, medium, large
   - States: default, hover, active, disabled
   - With and without icons

2. **Cards:**
   - Standard card with header, content, footer
   - Statistic cards for dashboard metrics
   - Interactive cards with hover effects

3. **Data Tables:**
   - Sortable columns
   - Filterable data
   - Pagination
   - Row selection
   - Mobile responsive views

4. **Forms:**
   - Input fields with validation states
   - Dropdowns and multi-selects
   - Date pickers
   - Toggle switches
   - Radio buttons and checkboxes

5. **Modals and Dialogs:**
   - Confirmation dialogs
   - Form modals
   - Information modals

6. **Navigation:**
   - Sidebar with collapsible sections
   - Top navigation bar
   - Breadcrumbs
   - Mobile navigation menu

7. **Feedback Elements:**
   - Toasts/notifications
   - Progress indicators
   - Loading states
   - Empty states

### Design Principles

1. **Consistency:** Maintain visual and functional consistency across the platform
2. **Hierarchy:** Use size, color, and spacing to establish visual hierarchy
3. **Accessibility:** Ensure components meet WCAG 2.1 AA standards
4. **Responsiveness:** Design for all device sizes from mobile to desktop
5. **Simplicity:** Keep interfaces clean and focused on the task at hand

## Database Schema

Design the Supabase PostgreSQL database schema with the following tables:

### 1. `users` Table

```sql
CREATE TABLE users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  position_id UUID REFERENCES positions,
  upline_id UUID REFERENCES users,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE
);
```

### 2. `roles` Table

```sql
CREATE TABLE roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. `user_roles` Table

```sql
CREATE TABLE user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users NOT NULL,
  role_id UUID REFERENCES roles NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);
```

### 4. `permissions` Table

```sql
CREATE TABLE permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(resource, action)
);
```

### 5. `role_permissions` Table

```sql
CREATE TABLE role_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  role_id UUID REFERENCES roles NOT NULL,
  permission_id UUID REFERENCES permissions NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);
```

### 6. `carriers` Table

```sql
CREATE TABLE carriers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  advance_rate DECIMAL(5,2) NOT NULL,
  logo_url TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 7. `products` Table

```sql
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  carrier_id UUID REFERENCES carriers NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(carrier_id, name)
);
```

### 8. `positions` Table

```sql
CREATE TABLE positions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  level INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 9. `commission_splits` Table

```sql
CREATE TABLE commission_splits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  position_id UUID REFERENCES positions NOT NULL,
  product_id UUID REFERENCES products NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(position_id, product_id)
);
```

### 10. `deals` Table

```sql
CREATE TABLE deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES users NOT NULL,
  carrier_id UUID REFERENCES carriers NOT NULL,
  product_id UUID REFERENCES products NOT NULL,
  client_name TEXT NOT NULL,
  client_dob DATE,
  client_phone TEXT,
  client_email TEXT,
  face_amount DECIMAL(12,2),
  monthly_premium DECIMAL(10,2) NOT NULL,
  annual_premium DECIMAL(10,2) NOT NULL,
  policy_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 11. `commissions` Table

```sql
CREATE TABLE commissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deal_id UUID REFERENCES deals NOT NULL,
  user_id UUID REFERENCES users NOT NULL,
  position_id UUID REFERENCES positions NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 12. `settings` Table

```sql
CREATE TABLE settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 13. `integrations` Table

```sql
CREATE TABLE integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 14. `daily_sales_counters` Table

```sql
CREATE TABLE daily_sales_counters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES users NOT NULL,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, date)
);
```

### Set up Database Triggers and Functions

Create triggers and functions to:
1. Automatically calculate commissions when a deal is created
2. Update the daily sales counter when a deal is created
3. Reset daily sales counters at midnight
4. Update timestamps on record changes

Example of commission calculation function:

```sql
CREATE OR REPLACE FUNCTION calculate_commissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the agent's position
  DECLARE agent_position_id UUID;
  SELECT position_id INTO agent_position_id FROM users WHERE id = NEW.agent_id;
  
  -- Get the agent's upline chain
  WITH RECURSIVE upline_chain AS (
    SELECT id, upline_id, position_id FROM users WHERE id = NEW.agent_id
    UNION
    SELECT u.id, u.upline_id, u.position_id
    FROM users u
    JOIN upline_chain uc ON u.id = uc.upline_id
  )
  
  -- Calculate commissions for each person in the upline chain
  INSERT INTO commissions (deal_id, user_id, position_id, amount, percentage)
  SELECT 
    NEW.id,
    uc.id,
    uc.position_id,
    (NEW.annual_premium * cs.percentage / 100),
    cs.percentage
  FROM upline_chain uc
  JOIN commission_splits cs ON uc.position_id = cs.position_id
  WHERE cs.product_id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_deal_insert
AFTER INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION calculate_commissions();
```

## 1. Set Up Supabase Authentication

Configure Supabase Auth with the following providers:
- Email/Password
- Google OAuth (optional)
- Microsoft OAuth (optional)

### 2. Create Auth Helper Functions

```typescript
// src/lib/auth.ts
import { createClient } from '@supabase/supabase-js';
import { User, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  return { data, error };
};

// Sign up with email and password
export const signUpWithEmail = async (email: string, password: string, metadata: { full_name: string }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  });
  
  return { data, error };
};

// Sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

// Get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Get current session
export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// Handle password reset
export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  return { data, error };
};

// Update password
export const updatePassword = async (new_password: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: new_password,
  });
  
  return { data, error };
};
```

### 3. Create Auth Context Provider

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, signInWithEmail, signUpWithEmail, signOut, getCurrentUser } from '../lib/auth';

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
    // Check for active session on app load
    const getInitialSession = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };
    
    getInitialSession();
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  const signIn = async (email: string, password: string) => {
    return signInWithEmail(email, password);
  };
  
  const signUp = async (email: string, password: string, fullName: string) => {
    return signUpWithEmail(email, password, { full_name: fullName });
  };
  
  const logout = async () => {
    return signOut();
  };
  
  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    logout,
    isAuthenticated: !!user,
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
```

### 4. Create Protected Route Component

```typescript
// src/components/ProtectedRoute.tsx
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { checkUserPermission } from '../lib/permissions';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredPermission?: string;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission 
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    // Check authentication
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    // Check permission if required
    if (requiredPermission && user) {
      const checkPermission = async () => {
        const hasPermission = await checkUserPermission(user.id, requiredPermission);
        if (!hasPermission) {
          router.push('/unauthorized');
        }
      };
      
      checkPermission();
    }
  }, [isAuthenticated, loading, requiredPermission, router, user]);
  
  // Show loading state
  if (loading) {
    return <div>Loading...</div>;
  }
  
  // Only render children if authenticated
  return isAuthenticated ? <>{children}</> : null;
};

export default ProtectedRoute;
```

### 5. Create User Invitation System

```typescript
// src/lib/invitations.ts
import { supabase } from './auth';
import { v4 as uuidv4 } from 'uuid';

// Send invitation to a new user
export const inviteUser = async ({
  email,
  fullName,
  roleId,
  positionId,
  uplineId,
}: {
  email: string;
  fullName: string;
  roleId: string;
  positionId: string;
  uplineId: string;
}) => {
  // Create a unique invitation token
  const invitationToken = uuidv4();
  
  // Store invitation in the database
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      email,
      full_name: fullName,
      role_id: roleId,
      position_id: positionId,
      upline_id: uplineId,
      token: invitationToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    })
    .select();
    
  if (error) {
    return { data: null, error };
  }
  
  // Generate invitation URL
  const invitationUrl = `${window.location.origin}/register?token=${invitationToken}`;
  
  // Send email with invitation URL
  // This would typically be done via a server function or email service
  
  return { data: { invitationUrl }, error: null };
};

// Verify invitation token
export const verifyInvitation = async (token: string) => {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
    
  if (error || !data) {
    return { data: null, error: error || new Error('Invalid or expired invitation') };
  }
  
  return { data, error: null };
};

// Complete registration with invitation
export const completeInvitedRegistration = async (token: string, password: string) => {
  // Verify the invitation
  const { data: invitation, error: verifyError } = await verifyInvitation(token);
  
  if (verifyError || !invitation) {
    return { data: null, error: verifyError };
  }
  
  // Create the user in Auth
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: invitation.email,
    password,
    options: {
      data: {
        full_name: invitation.full_name,
      }
    }
  });
  
  if (signUpError || !authData.user) {
    return { data: null, error: signUpError };
  }
  
  // Update the user profile with position and upline
  const { error: profileError } = await supabase
    .from('users')
    .update({
      position_id: invitation.position_id,
      upline_id: invitation.upline_id,
    })
    .eq('id', authData.user.id);
    
  if (profileError) {
    return { data: null, error: profileError };
  }
  
  // Assign the role
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: authData.user.id,
      role_id: invitation.role_id,
    });
    
  if (roleError) {
    return { data: null, error: roleError };
  }
  
  // Mark invitation as used
  const { error: invitationError } = await supabase
    .from('invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token);
    
  if (invitationError) {
    return { data: null, error: invitationError };
  }
  
  return { data: authData, error: null };
};
```

## Dashboard Implementation

### 1. Create Dashboard Layout

```tsx
// src/components/DashboardLayout.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  MenuIcon,
  XIcon,
  BellIcon,
  LogoutIcon,
} from '@heroicons/react/outline';

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, current: router.pathname === '/dashboard' },
    { name: 'Post a Deal', href: '/deals/new', icon: DocumentTextIcon, current: router.pathname === '/deals/new' },
    { name: 'Agents', href: '/agents', icon: UsersIcon, current: router.pathname.startsWith('/agents') },
    { name: 'Book', href: '/book', icon: DocumentTextIcon, current: router.pathname === '/book' },
    { name: 'Scoreboard', href: '/scoreboard', icon: ChartBarIcon, current: router.pathname === '/scoreboard' },
    { name: 'Configuration', href: '/configuration', icon: CogIcon, current: router.pathname.startsWith('/configuration') },
  ];
  
  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        {sidebarOpen && (
          <div className="fixed inset-0 flex z-40">
            <div className="fixed inset-0" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-600 opacity-75" onClick={() => setSidebarOpen(false)}></div>
            </div>
            
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-primary-700">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <XIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>
              
              <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                <div className="flex-shrink-0 flex items-center px-4">
                  <span className="text-xl font-bold text-white">MyAgentView</span>
                </div>
                <nav className="mt-5 px-2 space-y-1">
                  {navigation.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className={`${
                        item.current
                          ? 'bg-primary-800 text-white'
                          : 'text-white hover:bg-primary-600'
                      } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                    >
                      <item.icon
                        className="mr-4 h-6 w-6 text-primary-200"
                        aria-hidden="true"
                      />
                      {item.name}
                    </a>
                  ))}
                </nav>
              </div>
              <div className="flex-shrink-0 flex border-t border-primary-800 p-4">
                <button
                  onClick={handleLogout}
                  className="flex-shrink-0 group block text-white"
                >
                  <div className="flex items-center">
                    <div>
                      <LogoutIcon className="h-6 w-6" />
                    </div>
                    <div className="ml-3">
                      <p className="text-base font-medium">Logout</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-primary-700">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <span className="text-xl font-bold text-white">MyAgentView</span>
              </div>
              <nav className="mt-5 flex-1 px-2 space-y-1">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className={`${
                      item.current
                        ? 'bg-primary-800 text-white'
                        : 'text-white hover:bg-primary-600'
                    } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                  >
                    <item.icon
                      className="mr-3 h-5 w-5 text-primary-200"
                      aria-hidden="true"
                    />
                    {item.name}
                  </a>
                ))}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-primary-800 p-4">
              <button
                onClick={handleLogout}

## 15. Testing Strategy

### 1. Unit Testing

Use `Jest` for unit testing both frontend and backend logic.

**Frontend Unit Tests**
- Library: `Jest + React Testing Library`
- Coverage:
  - Deal submission and validation
  - Form logic and state handling
  - Dashboard rendering
  - Component states and edge cases

**Backend Logic Tests**
- Commission calculation logic
- Trigger execution via Supabase CLI
- Daily counters and status updates

### 2. Integration Testing

Use `Playwright` or `Cypress` to simulate complete user flows.

**Coverage:**
- Deal submission
- Dashboard and Scoreboard views
- Role-based module visibility
- Real-time updates for deals and metrics

### 3. E2E Testing with Supabase

Use Supabase CLI for staging tests.

- Setup: Seeding and teardown automation
- Recursive upline validation
- Test Supabase permissions, triggers, and storage

### 4. CI/CD Pipeline

Use GitHub Actions to:
- Run full test suites on each push
- Block deployment on test failure or low coverage
- Log failures to `activity_logs`

### 5. Mocking and Error Handling

- Use MSW and Jest for mocking API and Supabase calls
- Simulate timeouts, permissions errors, failed inserts

---

## 16. Enhancements and Production Mode Toggle

### Feature Flags via `settings` Table

```json
{
  "mode": "production", // or "testing"
  "enable_discord_webhook": true,
  "commission_debug_mode": false
}
```

Use this to toggle debug features or suppress notifications in testing.

---

## 17. Logging Tab

Add a tab in the admin UI for viewing system logs using the `activity_logs` table.

**Schema:**
```sql
CREATE TABLE activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);
```

**UI Features:**
- Filter logs by user, type, or time
- Toggle auto-refresh
- JSON view of metadata

---

## 18. Supabase Connection Status Checker

Show real-time connection status in the admin dashboard.

**Function Example:**
```ts
export const checkSupabaseConnection = async () => {
  const { error } = await supabase.from('users').select('id').limit(1);
  return !error;
};
```

**UI Output:**
- ✅ Connected (green dot)
- ❌ Disconnected (red dot)
- Button: “Run Health Test”

**Health Test Includes:**
- Read from `users`
- Insert/delete from test table
- Read `settings` and log result

---

## 19. RLS Safety Notice (For Development)

To avoid Row-Level Security (RLS) errors during development or MVP launch, **explicitly disable RLS** on all major tables unless you plan to define access policies.

### Disable RLS Example:
```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE commissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE carriers DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
```

Make sure to run these statements in your Supabase SQL editor or migration tool **before inserting or reading data** in dev mode.