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
  avatar_url: string | null;
  phone: string | null;
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
