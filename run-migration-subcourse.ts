import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Client } = pg;

async function runMigration() {
  const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.VITE_SUPABASE_URL?.split('.')[0].split('//')[1]}.supabase.co:5432/postgres`;
  
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20240422100000_add_subcourses.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);
    console.log('Migration applied successfully');
  } catch (err) {
    console.error('Error applying migration:', err);
  } finally {
    await client.end();
  }
}

runMigration();
