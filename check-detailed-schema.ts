import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkDetailedSchema() {
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
    
    const tables = ['sub_courses', 'modules', 'lessons', 'activities'];
    
    for (const table of tables) {
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}';
      `);
      console.log(`Table: ${table}`);
      console.table(res.rows);
    }

    // Check FKs
    const fkRes = await client.query(`
        SELECT
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('sub_courses', 'modules', 'lessons', 'activities');
    `);
    console.log('Foreign Keys:');
    console.table(fkRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkDetailedSchema();
