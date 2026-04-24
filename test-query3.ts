import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
  const { data, error } = await supabase.rpc('get_tables_info' as any); // just try anything or we can do raw query if we had pg. But this is rest api.
  console.log(await supabase.from('profiles').select('id').limit(1));
}

test();
