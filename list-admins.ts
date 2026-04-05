import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function listSuperAdmins() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const connectionString = `postgresql://postgres:${password}@db.okpruwomwojoshrbdewg.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('--- Super Admins in Memberships ---');
    const memberships = await client.query(`
      SELECT m.user_id, m.role, u.email, t.slug as tenant
      FROM public.memberships m
      JOIN auth.users u ON m.user_id = u.id
      JOIN public.tenants t ON m.tenant_id = t.id
      WHERE m.role = 'super_admin'
    `);
    console.log(memberships.rows);

    console.log('\n--- Super Admins in Profiles ---');
    const profiles = await client.query(`
      SELECT p.id, p.full_name, p.role, u.email
      FROM public.profiles p
      JOIN auth.users u ON p.id = u.id
      WHERE p.role = 'super_admin'
    `);
    console.log(profiles.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

listSuperAdmins();
