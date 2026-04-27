import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkData() {
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
    
    console.log('--- Modules with sub_course_id vs course_id ---');
    const res = await client.query(`
      SELECT id, title, course_id, sub_course_id 
      FROM modules 
      LIMIT 20;
    `);
    console.table(res.rows);

    const counts = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(course_id) as with_course,
        COUNT(sub_course_id) as with_subcourse
      FROM modules;
    `);
    console.table(counts.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkData();
