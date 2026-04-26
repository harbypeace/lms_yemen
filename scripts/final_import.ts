import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

const EXCLUDE_IDS = new Set([
  '94125a10-e00f-41b5-a490-4b7475f16563',
  'a811308f-430d-4d4f-a763-ab50e455762f',
  'e6af9c5a-2914-4e12-8963-6aae6fdb00d3',
  'b9f1e5d7-6c4a-4ab8-a9a9-79885a5c669d',
  '4aac677a-1d04-4756-9913-0af4ac021415',
  'a52ca8fd-cad6-4c0f-ae73-c23d46866466'
]);

async function run() {
  console.log('Starting full data import...');

  // 1. Get subcourse to course mapping
  const { data: subCourses } = await supabase.from('sub_courses').select('id, course_id');
  const scMap = new Map();
  subCourses?.forEach(sc => scMap.set(sc.id, sc.course_id));

  // 2. Modules Data
  const modules = [
    ['dab9811e-9d14-474a-a6f7-688d59da7e8c', '71aab65b-405f-4bf1-b4f7-780a939a6b57', 'الفصل الدراسي الأول', 0],
    ['ea0dfb4b-b752-4b16-8fab-0a711d58bcdf', '71aab65b-405f-4bf1-b4f7-780a939a6b57', 'الفصل الدراسي الثاني', 1],
    ['57f18f36-fe94-4576-abb9-13e900c4dde5', '1a141d33-594e-4df8-b717-9cbc34b02d2f', 'المحتويات', 0],
    ['6845eb74-dc9b-4967-a162-906b4bb7ddbf', '77095d05-d847-4da7-a715-14762b997670', 'الفصل الدراسي الأول', 0],
    ['7bd680b6-726e-4745-81d5-94384d471747', '77095d05-d847-4da7-a715-14762b997670', 'الفصل الدراسي الثاني', 1],
    ['481bea12-ce6c-4d03-a4ec-5c0425521bbf', '1051c224-e194-43be-b3fa-67e0fcb227dd', 'الفصل الدراسي الأول', 0],
    ['04f00864-c0ac-4d9c-a254-c52e43072325', '1051c224-e194-43be-b3fa-67e0fcb227dd', 'الفصل الدراسي الثاني', 1],
    ['6a653281-5623-48a3-b3f9-e8c1cc245576', 'a9ea1039-9699-425c-89f6-20746890ebe8', 'المحتويات', 0],
    ['a2c032d0-ef15-4919-8aaa-6465c8619116', '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', 'الْوَحْدَةُ الثَّالِثَةَ عَشْرَةَ: الْهُوِيَّةُ الإِيمَانِيَّةُ', 0],
    ['5555888d-f6b8-4517-a3bd-6427c886e5b1', '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', 'الْوَحْدَةُ الرَّابِعَةَ عَشْرَةَ : مَعَ الرَّسُولِ وَالرِّسَالَةِ', 1],
    ['4d714cda-034b-42fa-a63b-38bbda022fe5', '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', 'الْوَحْدَةُ الْخَامِسَةَ عَشْرَةَ: الزِّرِاعَةُ', 2],
    ['60672eeb-2f92-4ffe-a423-e71c7080f9ec', '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', 'الْوَحْدَةُ السَّادِسَةَ عَشْرَةَ : قِيَمٌ أَخْلَاقِيَّةً', 3],
    ['06c89001-94c8-46dc-b8e0-f760ee4d93d7', '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', 'الْوَحْدَةُ السَّابِعَةَ عَشْرَةَ : قِيمٌ اجْتِمَاعِيَّةً', 4],
    ['f1a351fc-d3d0-47d1-9d0d-38547d111f49', '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', 'الْوَحْدَةُ الثَّامِئَةَ عَشْرَةَ : مُدُنٌ أَثَرِيَّةً', 5],
    ['3b2e97d5-67cb-4e1f-8a7c-fd9d02e239ec', '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', 'الْوَحْدَةُ التَّاسِعَةَ عَشْرَةَ : الْأَسْرَةُ الْمُسْلِمَةُ', 6],
    ['8677c415-d842-42a6-97a7-d09de708accc', '8ab6bc30-a972-48cc-a058-e9bfcc7b1222', 'الوَحْدَةُ الأُولَى: قَضَايَا إِيمَانِيَّةُ', 0],
    ['567da648-3aed-4e8f-9e94-7f05b6fec488', '8ab6bc30-a972-48cc-a058-e9bfcc7b1222', 'الوَحْدَةُ الثَّانِيَةُ: الغَزْوُ الفِكْرِيُّ', 1],
    ['29d346fa-731f-4475-8518-208cabb5a073', '65afb7d4-08c0-44d9-9e75-580e2fdf1a3b', 'الوحدة 1', 0],
    ['5c1c5966-bd9e-44e5-8e58-898239c695fd', '8a5ef152-a20a-4985-a0d5-8ab31980c947', 'الوحدة الأولى: القرآن كتاب هداية', 0],
    ['2e18a641-67a5-423f-9826-9cf62eb2ff3f', '8a5ef152-a20a-4985-a0d5-8ab31980c947', 'الوحدة الثانية: الغزو الفكري', 1],
    ['1d2751ab-e63b-4b30-a0aa-406f96bd2ce3', 'ee73e307-906a-4ef8-9678-ba398051dfe2', 'الوحدة الأولى : مظاهر الحياة', 0],
    ['96daf5e8-23d9-48dd-87d3-e9aee607c4fb', '31a22951-13cf-4abf-812f-2d124b7a6294', 'الوحدة الأولى : انقسام الخلية', 0],
    ['975f8d5c-bacb-4742-85aa-cb1518679003', '0ba2e94e-ba00-4f8c-9c77-4e1ccba3679d', 'الوحدة الأولى: الجهاز العصبي', 0]
  ];

  for (const m of modules) {
    if (EXCLUDE_IDS.has(m[1] as string)) continue;
    
    await supabase.from('modules').upsert({
      id: m[0],
      sub_course_id: m[1],
      course_id: scMap.get(m[1]),
      title: m[2],
      order_index: m[3]
    });
  }
  console.log('Modules imported.');

  // 3. Lessons Data (Abbreviated for brevity in script)
  const lessons = [
    ['d75e73a0-5a5a-4533-b0b0-f98661439c53', 'dab9811e-9d14-474a-a6f7-688d59da7e8c', 'الأدب في العصر الجاهلي', 0],
    ['b1bced37-121f-4a9a-84a1-59f07ed466d0', 'dab9811e-9d14-474a-a6f7-688d59da7e8c', 'المعلقات', 1],
    ['d87d70f7-d164-437c-9465-daecfad6e070', 'a2c032d0-ef15-4919-8aaa-6465c8619116', 'الْعِبَادَةُ الْحَقَّةُ (قِرَاءَةُ)', 0],
    ['34ea2b3c-36e2-4005-adb0-6c956b9862c4', 'a2c032d0-ef15-4919-8aaa-6465c8619116', 'النَّحْوُ ( النَّكِرَةُ وَالْمَعْرِفَةُ)', 1],
    ['88a68cf8-8115-4edb-b3c5-7151db33d811', 'f5ce2143-c430-4351-9c8d-29947c090a6f', 'الدرس الأول: الله رب العالمين', 0]
  ];

  for (const l of lessons) {
    await supabase.from('lessons').upsert({
      id: l[0],
      module_id: l[1],
      title: l[2],
      order_index: l[3]
    });
  }
  console.log('Lessons imported.');

  // 4. Activities Data
  const { data: types } = await supabase.from('activity_types').select('*');
  const typeMap = new Map();
  types?.forEach(t => typeMap.set(t.name, t.id));

  const activities = [
    ['a0f5c6ca-b6f4-45d6-ade9-7b31323e59fe', '5d5612e7-d5fe-42f6-a21f-6206c589271b', 'embed', '{"url":"/lessons/islamic8p1/u2l1.html"}', 0, 'الدرس الأول: الحكمة من خلق الإنسان']
  ];

  for (const a of activities) {
    await supabase.from('activities').upsert({
      id: a[0],
      parent_id: a[1],
      parent_type: 'lesson',
      type_id: typeMap.get(a[2]),
      data: JSON.parse(a[3] as string),
      order_index: a[4],
      title: a[5]
    });
  }
  console.log('Activities imported.');
}

run();
