import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
  console.log("Testing search users query...");
  const { data, error } = await supabase.from('profiles').select(`
    id, username, memberships!inner(role)
  `).limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}

test();
