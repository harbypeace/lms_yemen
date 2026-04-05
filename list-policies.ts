import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function listPolicies() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    console.error('No SUPABASE_DB_PASSWORD found');
    return;
  }

  const connectionString = `postgresql://postgres:${password}@db.okpruwomwojoshrbdewg.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename IN ('memberships', 'tenants', 'profiles');
    `);
    console.log('Current Policies:');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

listPolicies();
