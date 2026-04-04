import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function migrateDB() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    console.error('No SUPABASE_DB_PASSWORD found');
    return;
  }

  const connectionString = `postgresql://postgres:${password}@db.okpruwomwojoshrbdewg.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database');

    const sql = `
      ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS address text;
    `;

    await client.query(sql);
    console.log('Migration successful.');
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

migrateDB();
