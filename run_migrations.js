import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres.okpruwomwojoshrbdewg:sb_publishable_2DaEOu1x78bzJPOkz-lGKA_DNXRfe6v@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        console.log(`Successfully ran migration: ${file}`);
      }
    }
  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
