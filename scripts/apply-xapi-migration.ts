import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function applyMigration() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    console.error('No SUPABASE_DB_PASSWORD found');
    return;
  }

  const connectionString = `postgresql://postgres:${password}@db.okpruwomwojoshrbdewg.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to Supabase DB.');

    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20240402004000_xapi_lite.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying xAPI Lite migration...');
    await client.query(sql);

    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await client.end();
  }
}

applyMigration();
