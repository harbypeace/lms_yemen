import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log('Testing xAPI public query...');
  const { data, error } = await supabase
    .from('xapi_statements')
    .select('*, profiles(full_name, avatar_url)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Query error:', error);
  } else {
    console.log('Query success:', data);
  }
}

test();
