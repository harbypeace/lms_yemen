import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function findOrphanedModules() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const project = process.env.VITE_SUPABASE_URL?.split('.')[0].split('//')[1];
  
  if (!password || !project) {
    console.error('Missing env vars');
    return;
  }

  const connectionString = `postgresql://postgres:${password}@db.${project}.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    console.log('--- Modules with NULL sub_course_id ---');
    const res = await client.query(`
      SELECT m.id, m.title, m.course_id, c.title as course_title
      FROM modules m
      JOIN courses c ON m.course_id = c.id
      WHERE m.sub_course_id IS NULL;
    `);
    console.table(res.rows);

    console.log('--- Subcourses ---');
    const sc = await client.query(`SELECT id, title, course_id FROM sub_courses;`);
    console.table(sc.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

findOrphanedModules();
