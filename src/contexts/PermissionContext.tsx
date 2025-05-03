import React, { createContext, useContext } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

type Permission = {
  section: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type PermissionContextType = {
  permissions: Permission[];
  isLoading: boolean;
  error: any; // Changed from Error | null to any to handle unknown error types
  canAccess: (section: string, action?: 'view' | 'edit' | 'delete') => boolean;
};

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  console.log("PermissionProvider - User:", user);

  const { data: permissions = [], isLoading, error } = useQuery<Permission[]>(
    ['permissions', user?.id],
    async () => {
      console.log("Fetching permissions for user:", user?.id);
      
      if (!user?.id) {
        console.log("No user ID, returning empty permissions");
        return [];
      }
      
      try {
        // First get the user's position_id
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, position_id')
          .eq('id', user.id)
          .single();
        
        if (userError) {
          console.error("Error fetching user data:", userError);
          throw userError;
        }
        
        // Then get the position details
        const { data: positionData, error: positionError } = await supabase
          .from('positions')
          .select('id, name, level')
          .eq('id', userData.position_id)
          .single();
        
        if (positionError) {
          console.error("Error fetching position data:", positionError);
          throw positionError;
        }
        
        // Extract position data
        const positionName = positionData?.name?.toLowerCase() || 'agent';
        const positionLevel = positionData?.level || 1; // Default to agent (level 1) if position is not set
        
        console.log(`User position from database: ${positionName} (level ${positionLevel})`);
        
        // Determine user role based on position
        const isOwner = positionName === 'owner' || positionLevel === 5;
        const isAdmin = positionName === 'admin' || positionLevel === 4;
        const isManager = positionName === 'manager' || positionLevel === 3;
        const isSeniorAgent = positionName === 'senior agent' || positionLevel === 2;
        
        // Define permissions based on position
        let permissionsBySection: Record<string, Permission> = {};
        
        // Base permissions for all users
        const baseSections = [
          'dashboard',
          'post-deal',
          'book',
          'settings'
        ];
        
        // Add base permissions
        baseSections.forEach(section => {
          permissionsBySection[section] = {
            section,
            can_view: true,
            can_edit: true,
            can_delete: false
          };
        });
        
        // Add position-specific permissions
        if (isManager || isAdmin || isOwner) {
          // Managers, admins, and owners can view agents but only owners can edit
          permissionsBySection['agents'] = {
            section: 'agents',
            can_view: true,
            can_edit: isOwner,
            can_delete: isOwner
          };
        }
        
        // Only owners and admins can access configuration
        if (isOwner || isAdmin) {
          permissionsBySection['configuration'] = {
            section: 'configuration',
            can_view: true,
            can_edit: true,
            can_delete: true
          };
          
          permissionsBySection['monitoring'] = {
            section: 'monitoring',
            can_view: true,
            can_edit: isOwner,
            can_delete: isOwner
          };
        }
        
        const userPermissions = Object.values(permissionsBySection);
        console.log("User permissions:", userPermissions);
        return userPermissions;
      } catch (error) {
        console.error("Error determining user permissions:", error);
        
        // Fallback to basic permissions
        const basicPermissions = [
          {
            section: 'dashboard',
            can_view: true,
            can_edit: false,
            can_delete: false
          },
          {
            section: 'post-deal',
            can_view: true,
            can_edit: true,
            can_delete: false
          },
          {
            section: 'book',
            can_view: true,
            can_edit: false,
            can_delete: false
          }
        ];
        
        return basicPermissions;
      }
    },
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      cacheTime: 10 * 60 * 1000 // Keep in cache for 10 minutes
    }
  );

  const canAccess = (section: string, action: 'view' | 'edit' | 'delete' = 'view'): boolean => {
    console.log(`Checking access for section: ${section}, action: ${action}`);
    
    // If no user or loading, deny access
    if (!user?.id || isLoading) {
      console.log("No user or still loading, denying access");
      return false;
    }

    // Find permission for the section
    const permission = permissions.find(p => p.section === section);
    
    // If no permission found, deny access
    if (!permission) {
      console.log(`No permission found for section: ${section}, denying access`);
      return false;
    }
    
    // Check specific action permission
    let hasAccess = false;
    switch (action) {
      case 'view':
        hasAccess = permission.can_view;
        break;
      case 'edit':
        hasAccess = permission.can_edit;
        break;
      case 'delete':
        hasAccess = permission.can_delete;
        break;
      default:
        hasAccess = false;
    }
    
    console.log(`Access for ${section}/${action}: ${hasAccess}`);
    return hasAccess;
  };

  return (
    <PermissionContext.Provider value={{ permissions, isLoading, error, canAccess }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};