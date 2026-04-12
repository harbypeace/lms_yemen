import { createClient } from '@supabase/supabase-js'

const getSupabaseConfig = () => {
  const meta = import.meta as any;
  const env = meta.env || (typeof process !== 'undefined' ? process.env : {});
  
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_KEY;
  
  // Default fallback values
  const defaultUrl = 'https://okpruwomwojoshrbdewg.supabase.co';
  const defaultKey = ''; // Should be provided via env
  
  const finalUrl = (url && url.startsWith('http')) ? url : defaultUrl;
  const finalKey = key || defaultKey;
  
  return { finalUrl, finalKey };
};

const { finalUrl, finalKey } = getSupabaseConfig();
export const supabase = createClient(finalUrl, finalKey);

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  role: 'student' | 'parent' | 'teacher' | 'school_admin' | 'super_admin' | null;
  grade: string | null;
  city: string | null;
  address: string | null;
  school_name: string | null;
  parent_id: string | null;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
};

export type Membership = {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';
  tenants: Tenant;
};

export type Notification = {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  link?: string;
  created_at: string;
};

export type XApiStatement = {
  id: string;
  user_id: string;
  tenant_id?: string;
  verb: 'start' | 'end' | 'score' | 'store';
  activity_id: string;
  activity_type?: string;
  score?: number;
  max_score?: number;
  success?: boolean;
  completion?: boolean;
  duration?: string;
  metadata: any;
  is_public: boolean;
  created_at: string;
};
