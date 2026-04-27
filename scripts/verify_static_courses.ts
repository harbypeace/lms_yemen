import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('--- Static Course Verification ---');
  
  const { data: subCourses, error } = await supabase
    .from('sub_courses')
    .select('id, title, slug');

  if (error) {
    console.error('Error fetching subcourses:', error);
    return;
  }

  const staticBaseDir = path.join(process.cwd(), 'public', 'static-courses');
  
  if (!fs.existsSync(staticBaseDir)) {
    console.log('Error: public/static-courses directory not found.');
    return;
  }

  const results = [];

  for (const sc of subCourses || []) {
    const scDir = path.join(staticBaseDir, sc.slug || sc.id);
    const hasFolder = fs.existsSync(scDir);
    const structPath = path.join(scDir, 'structure.json');
    const hasStructure = fs.existsSync(structPath);
    
    let structureInfo = 'N/A';
    if (hasStructure) {
      try {
        const content = fs.readFileSync(structPath, 'utf-8');
        const json = JSON.parse(content);
        const lessonCount = Object.keys(json.lessons || {}).length;
        structureInfo = `Found (${lessonCount} lessons)`;
      } catch (e) {
        structureInfo = 'ERROR: Invalid JSON';
      }
    }

    results.push({
      id: sc.id.substring(0, 8) + '...',
      title: sc.title.substring(0, 30),
      slug: sc.slug || 'N/A',
      has_folder: hasFolder ? '✅' : '❌',
      structure: structureInfo
    });
  }

  console.table(results);
}

run();
