import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function fixTenantsRLS() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    console.error('No SUPABASE_DB_PASSWORD found');
    return;
  }

  const connectionString = `postgresql://postgres:${password}@db.okpruwomwojoshrbdewg.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    // Allow all authenticated users to view all tenants
    await client.query(`
      CREATE POLICY "Authenticated users can view all tenants"
      ON public.tenants
      FOR SELECT
      TO authenticated
      USING (true);
    `);
    
    // Allow users to insert memberships for themselves
    await client.query(`
      CREATE POLICY "Users can insert their own memberships"
      ON public.memberships
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
    `);

    console.log('RLS policies updated successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

fixTenantsRLS();
