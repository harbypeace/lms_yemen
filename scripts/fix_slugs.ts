import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log('Fixing course slugs...');

  const { data: courses } = await supabase.from('courses').select('id, title, slug');
  
  for (const course of courses || []) {
    if (!course.slug) {
      const newSlug = course.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-') + '-' + course.id.slice(0, 4);
      
      console.log(`Updating ${course.title} with slug ${newSlug}`);
      await supabase.from('courses').update({ slug: newSlug }).eq('id', course.id);
    }
  }

  console.log('Finished fixing slugs.');
}

run();
