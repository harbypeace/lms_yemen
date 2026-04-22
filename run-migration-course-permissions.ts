import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${new URL(process.env.VITE_SUPABASE_URL || '').hostname.split('.')[0]}.supabase.co:5432/postgres`,
};

async function runMigration() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log('Connected to Supabase database');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20240422111000_course_permissions.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
