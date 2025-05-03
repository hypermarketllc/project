export type UserAccount = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string;
  theme_preference: 'light' | 'dark' | 'system';
  notification_preferences: {
    email: boolean;
    push: boolean;
    deals: boolean;
    system: boolean;
  };
  created_at: string;
  updated_at: string;
};

export type Agent = {
  id: string;
  email: string;
  full_name: string;
  position_id?: string;
  upline_id?: string;
  created_at: string;
  updated_at: string;
  national_producer_number?: string;
  annual_goal?: number;
  permission_level_id?: string;
  phone?: string;
  is_active: boolean;
  positions?: Position;
  upline?: Agent;
  permission_levels?: PermissionLevel;
  user_account?: UserAccount;
};

export type PermissionLevel = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
};

export type Role = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
};

export type Position = {
  id: string;
  name: string;
  level: number;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type Carrier = {
  id: string;
  name: string;
  advance_rate: number;
  logo_url?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  carrier_id: string;
  name: string;
  type: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type CommissionSplit = {
  id: string;
  position_id: string;
  product_id: string;
  percentage: number;
  created_at: string;
  updated_at: string;
};

export type Deal = {
  id: string;
  agent_id: string;
  carrier_id: string;
  product_id: string;
  client_name: string;
  client_dob?: string;
  client_phone?: string;
  client_email?: string;
  face_amount?: number;
  monthly_premium: number;
  annual_premium: number;
  policy_number?: string;
  app_number?: string;
  effective_date?: string;
  from_referral?: boolean;
  notes?: string;
  status: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  agents?: Agent;
  carriers?: Carrier;
  products?: Product;
  users?: any;
};

export type Commission = {
  id: string;
  deal_id: string;
  user_id: string;
  position_id: string;
  amount: number;
  percentage: number;
  status: 'pending' | 'paid';
  paid_at?: string;
  created_at: string;
  updated_at: string;
};

export type Settings = {
  id: string;
  key: string;
  value: any;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type Integration = {
  id: string;
  name: string;
  type: string;
  config: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DailySalesCounter = {
  id: string;
  agent_id: string;
  date: string;
  count: number;
  created_at: string;
  updated_at: string;
};

export type SystemLog = {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
};

export type SystemStatus = {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'down';
  last_check: string;
  details?: Record<string, any>;
  created_at: string;
  updated_at: string;
};