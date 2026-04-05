import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Service Role Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'enrollments';" });
  
  if (error) {
    console.error('Error fetching policies via RPC:', error);
    // Let's try another way if RPC doesn't exist
  } else {
    console.log('Policies:', data);
  }
}

checkPolicies();
