import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function ensureGeneralTenant() {
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
      SELECT * FROM public.tenants WHERE slug = 'general';
    `);
    
    if (res.rows.length === 0) {
      console.log('General tenant not found. Creating it...');
      await client.query(`
        INSERT INTO public.tenants (name, slug)
        VALUES ('General', 'general');
      `);
      console.log('General tenant created.');
    } else {
      console.log('General tenant already exists.');
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

ensureGeneralTenant();
