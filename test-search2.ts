import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
  try {
    const role = 'student';
    let memQuery = supabaseAdmin.from('memberships').select('user_id');
    if (role) memQuery = memQuery.eq('role', role);
    
    const { data: mems, error: memError } = await memQuery;
    if (memError) throw memError;
    
    let validUserIds = mems ? mems.map((m: any) => m.user_id) : [];
    console.log("Valid user ids length:", validUserIds.length);
    
    if (validUserIds.length > 0) {
      let query = supabaseAdmin.from('profiles').select('id, full_name, username');
      query = query.in('id', validUserIds);
      
      const { data, error } = await query;
      if (error) throw error;
      console.log("Profiles count:", data?.length);
      console.log("Profiles:", data);
    }
  } catch (err: any) {
    console.log("Error:", err.message);
  }
}
test();
