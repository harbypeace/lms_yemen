import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Client } = pg;

async function runMigrations() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    console.error('No SUPABASE_DB_PASSWORD found in .env');
    return;
  }

  const connectionString = `postgresql://postgres:${password}@db.okpruwomwojoshrbdewg.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to Supabase DB.');

    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    
    // Only run the new migrations
    const filesToRun = [
      '20240402003000_notifications.sql',
      '20240402003001_progress_notifications.sql',
      '20240402005000_integrations_and_sync.sql',
      '20240402006000_quizzes_and_notes.sql',
      '20240402007000_adaptive_slide_engine.sql',
      '20240402009000_course_prerequisites.sql',
      '20240402010000_rename_tables.sql',
      '20240402011000_enhance_activities.sql',
      '20240402012000_security_hardening.sql',
      '20240402013000_notification_preferences.sql'
    ];

    for (const file of filesToRun) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await client.query(sql);
        console.log(`Successfully ran migration: ${file}`);
      } catch (e) {
        console.error(`Error running ${file}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    await client.end();
  }
}

runMigrations();
