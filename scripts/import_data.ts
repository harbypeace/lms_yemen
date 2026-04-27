import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

const EXCLUDE_COURSE_IDS = [
  '94125a10-e00f-41b5-a490-4b7475f16563',
  'a811308f-430d-4d4f-a763-ab50e455762f',
  'e6af9c5a-2914-4e12-8963-6aae6fdb00d3',
  'b9f1e5d7-6c4a-4ab8-a9a9-79885a5c669d',
  '4aac677a-1d04-4756-9913-0af4ac021415',
  'a52ca8fd-cad6-4c0f-ae73-c23d46866466'
];

async function run() {
  console.log('Starting data import...');

  // 1. Get subcourse to course mapping
  const { data: subCourses } = await supabase.from('sub_courses').select('id, course_id');
  const scMap = new Map();
  subCourses?.forEach(sc => scMap.set(sc.id, sc.course_id));

  // 2. Import Modules (Partial list based on user SQL, excluding English)
  const modulesToImport = [
    {id: 'dab9811e-9d14-474a-a6f7-688d59da7e8c', parent_id: '71aab65b-405f-4bf1-b4f7-780a939a6b57', title: 'الفصل الدراسي الأول', order_index: 0},
    {id: 'ea0dfb4b-b752-4b16-8fab-0a711d58bcdf', parent_id: '71aab65b-405f-4bf1-b4f7-780a939a6b57', title: 'الفصل الدراسي الثاني', order_index: 1},
    {id: '57f18f36-fe94-4576-abb9-13e900c4dde5', parent_id: '1a141d33-594e-4df8-b717-9cbc34b02d2f', title: 'المحتويات', order_index: 0},
    {id: '6845eb74-dc9b-4967-a162-906b4bb7ddbf', parent_id: '77095d05-d847-4da7-a715-14762b997670', title: 'الفصل الدراسي الأول', order_index: 0},
    {id: '7bd680b6-726e-4745-81d5-94384d471747', parent_id: '77095d05-d847-4da7-a715-14762b997670', title: 'الفصل الدراسي الثاني', order_index: 1},
    {id: '481bea12-ce6c-4d03-a4ec-5c0425521bbf', parent_id: '1051c224-e194-43be-b3fa-67e0fcb227dd', title: 'الفصل الدراسي الأول', order_index: 0},
    {id: '04f00864-c0ac-4d9c-a254-c52e43072325', parent_id: '1051c224-e194-43be-b3fa-67e0fcb227dd', title: 'الفصل الدراسي الثاني', order_index: 1},
    {id: '6a653281-5623-48a3-b3f9-e8c1cc245576', parent_id: 'a9ea1039-9699-425c-89f6-20746890ebe8', title: 'المحتويات', order_index: 0},
    {id: 'a2c032d0-ef15-4919-8aaa-6465c8619116', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ الثَّالِثَةَ عَشْرَةَ: الْهُوِيَّةُ الإِيمَانِيَّةُ', order_index: 0},
    {id: '5555888d-f6b8-4517-a3bd-6427c886e5b1', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ الرَّابِعَةَ عَشْرَةَ : مَعَ الرَّسُولِ وَالرِّسَالَةِ', order_index: 1},
    {id: '4d714cda-034b-42fa-a63b-38bbda022fe5', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ الْخَامِسَةَ عَشْرَةَ: الزِّرِاعَةُ', order_index: 2},
    {id: '60672eeb-2f92-4ffe-a423-e71c7080f9ec', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ السَّادِسَةَ عَشْرَةَ : قِيَمٌ أَخْلَاقِيَّةً', order_index: 3},
    {id: '06c89001-94c8-46dc-b8e0-f760ee4d93d7', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ السَّابِعَةَ عَشْرَةَ : قِيمٌ اجْتِمَاعِيَّةً', order_index: 4},
    {id: 'f1a351fc-d3d0-47d1-9d0d-38547d111f49', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ الثَّامِئَةَ عَشْرَةَ : مُدُنٌ أَثَرِيَّةً', order_index: 5},
    {id: '3b2e97d5-67cb-4e1f-8a7c-fd9d02e239ec', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ التَّاسِعَةَ عَشْرَةَ : الْأَسْرَةُ الْمُسْلِمَةُ', order_index: 6},
    {id: 'e56fbc03-0921-43c0-a31c-b457e49476fe', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ الْعِشْرُونَ : شَخْصِيَّاتٌ وَأَعْلَامٌ جَهَادِيَّةٌ', order_index: 7},
    {id: 'c82d4b7e-475e-4468-8582-eb2c774185da', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحِدَةُ الْحَادِيَةُ وَالْعِشْرُونَ : الْوَعْيُ الثَّقَافِيُّ', order_index: 8},
    {id: 'ea1b627f-1829-454a-b489-12388745421d', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ الثَّانِيَةُ وَالْعِشْرُونَ : قَضَايَا وَطَنِيَّةً', order_index: 9},
    {id: '94bcc385-a5f0-4ba4-840a-688caeca03a5', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ الثَّالِثَةُ وَالْعِشْرُونَ : مِنْ مَخْلُوقَاتِ اللَّهِ', order_index: 10},
    {id: 'ac228cd8-6752-43b7-b788-b2b4e18d501e', parent_id: '05ded2af-937a-4ff7-8aa8-ac089c2ccf9b', title: 'الْوَحْدَةُ الرَّابِعَةُ وَالْعِشْرُونَ : نَوَادِرُ وَفَكَاهَاتٌ', order_index: 11},
    {id: '8677c415-d842-42a6-97a7-d09de708accc', parent_id: '8ab6bc30-a972-48cc-a058-e9bfcc7b1222', title: 'الوَحْدَةُ الأُولَى: قَضَايَا إِيمَانِيَّةُ', order_index: 0},
    {id: '567da648-3aed-4e8f-9e94-7f05b6fec488', parent_id: '8ab6bc30-a972-48cc-a058-e9bfcc7b1222', title: 'الوَحْدَةُ الثَّانِيَةُ: الغَزْوُ الفِكْرِيُّ', order_index: 1},
    {id: '7f8beb95-36a7-4a53-90d7-c2b4680b81c7', parent_id: '8ab6bc30-a972-48cc-a058-e9bfcc7b1222', title: 'الوَحْدَةُ الثَّالِثَةُ: قِيمٌ أَخْلَاقِيَّةُ', order_index: 2},
    {id: '29d346fa-731f-4475-8518-208cabb5a073', parent_id: '65afb7d4-08c0-44d9-9e75-580e2fdf1a3b', title: 'الوحدة 1', order_index: 0},
    {id: 'b06ed766-4c4b-4da3-bb1f-240ee7a43784', parent_id: '65afb7d4-08c0-44d9-9e75-580e2fdf1a3b', title: 'الوحدة 2', order_index: 1},
    {id: '808a570c-b2ce-4d43-af0d-da928bfbef69', parent_id: '65afb7d4-08c0-44d9-9e75-580e2fdf1a3b', title: 'الوحدة 3', order_index: 2},
    {id: '5c1c5966-bd9e-44e5-8e58-898239c695fd', parent_id: '8a5ef152-a20a-4985-a0d5-8ab31980c947', title: 'الوحدة الأولى: القرآن كتاب هداية', order_index: 0},
    {id: 'ee73e307-906a-4ef8-9678-ba398051dfe2', parent_id: 'ee73e307-906a-4ef8-9678-ba398051dfe2', title: 'الوحدة الأولى : مظاهر الحياة', order_index: 0},
    {id: '31a22951-13cf-4abf-812f-2d124b7a6294', parent_id: '31a22951-13cf-4abf-812f-2d124b7a6294', title: 'الوحدة الأولى : انقسام الخلية', order_index: 0},
    {id: '0ba2e94e-ba00-4f8c-9c77-4e1ccba3679d', parent_id: '0ba2e94e-ba00-4f8c-9c77-4e1ccba3679d', title: 'الوحدة الأولى: الجهاز العصبي', order_index: 0},
    {id: '26d465c2-6850-4a83-adc7-baf07c4075f4', parent_id: '26d465c2-6850-4a83-adc7-baf07c4075f4', title: 'الوحدة الأولى : علم الكيمياء وتطوره', order_index: 0},
    {id: '866b14b9-c625-4d4a-8a18-641f598a95a2', parent_id: '866b14b9-c625-4d4a-8a18-641f598a95a2', title: 'الوحدة الأولى : عناصر المجموعة الرئيسة الثالثة', order_index: 0},
    {id: 'd676356a-0ae0-42d9-b47d-419b1bdb1acc', parent_id: 'd676356a-0ae0-42d9-b47d-419b1bdb1acc', title: 'الوحدة الأولى : العناصر الانتقالية', order_index: 0},
    {id: '7543ce3d-c2db-4b3a-b2a6-4651e5b6e964', parent_id: '5c5a54ec-ef8b-4b90-8639-74fdbe3bb67c', title: 'الوحدة الأولى : الإنسان والفضاء', order_index: 0},
    // ... more modules
  ];

  const processedModules = modulesToImport
    .filter(m => !EXCLUDE_COURSE_IDS.includes(m.parent_id))
    .map(m => {
      const courseId = scMap.get(m.parent_id) || m.parent_id;
      let subCourseId = scMap.has(m.parent_id) ? m.parent_id : null;
      
      // If we don't have a subCourseId, try to find one for this course
      if (!subCourseId) {
        const entry = Array.from(scMap.entries()).find(([scId, cId]) => cId === courseId);
        if (entry) {
          subCourseId = entry[0];
        }
      }
      return {
        id: m.id,
        course_id: courseId,
        sub_course_id: subCourseId,
        title: m.title,
        order_index: m.order_index
      };
    });

  for (const m of processedModules) {
    const { error } = await supabase.from('modules').upsert(m);
    if (error) console.error(`Error importing module ${m.id}:`, error.message);
  }

  console.log(`Imported ${processedModules.length} modules.`);

  // 3. Import Lessons
  const lessonsToImport = [
    {id: 'd75e73a0-5a5a-4533-b0b0-f98661439c53', module_id: 'dab9811e-9d14-474a-a6f7-688d59da7e8c', title: 'الأدب في العصر الجاهلي', order_index: 0},
    {id: 'b1bced37-121f-4a9a-84a1-59f07ed466d0', module_id: 'dab9811e-9d14-474a-a6f7-688d59da7e8c', title: 'المعلقات', order_index: 1},
    {id: 'cecf015a-73bb-46be-b40d-8ac6e5c26841', module_id: 'dab9811e-9d14-474a-a6f7-688d59da7e8c', title: 'خصائص الشعر الجاهلي', order_index: 2},
    {id: '47c72da2-cff2-4c2b-bc94-d9faee86204d', module_id: 'dab9811e-9d14-474a-a6f7-688d59da7e8c', title: 'خيل وليل', order_index: 3},
    {id: 'd87d70f7-d164-437c-9465-daecfad6e070', module_id: 'a2c032d0-ef15-4919-8aaa-6465c8619116', title: 'الْعِبَادَةُ الْحَقَّةُ (قِرَاءَةُ)', order_index: 0},
    {id: '34ea2b3c-36e2-4005-adb0-6c956b9862c4', module_id: 'a2c032d0-ef15-4919-8aaa-6465c8619116', title: 'النَّحْوُ ( النَّكِرَةُ وَالْمَعْرِفَةُ)', order_index: 1},
    {id: '5d5612e7-d5fe-42f6-a21f-6206c589271b', module_id: 'f5ce2143-c430-4351-9c8d-29947c090a6f', title: 'الدرس الأول: الحكمة من خلق الإنسان', order_index: 0},
    // ... more lessons
  ];

  // We need to filter lessons by checking if their module was imported
  const importedModuleIds = new Set(processedModules.map(m => m.id));
  const processedLessons = lessonsToImport
    .filter(l => importedModuleIds.has(l.module_id))
    .map(l => ({
      id: l.id,
      module_id: l.module_id,
      title: l.title,
      order_index: l.order_index
    }));

  for (const l of processedLessons) {
    const { error } = await supabase.from('lessons').upsert(l);
    if (error) console.error(`Error importing lesson ${l.id}:`, error.message);
  }

  console.log(`Imported ${processedLessons.length} lessons.`);

  // 4. Import Activities
  const { data: types } = await supabase.from('activity_types').select('*');
  const typeMap = (types || []).reduce((acc, t) => ({ ...acc, [t.name]: t.id }), {});

  const activitiesToImport = [
    {activity_id: 'a0f5c6ca-b6f4-45d6-ade9-7b31323e59fe', lesson_id: '5d5612e7-d5fe-42f6-a21f-6206c589271b', activity_type: 'embed', content: '{"embed_url":"/lessons/islamic8p1/u2l1.html"}', order_index: 0, title: 'الدرس الأول: الحكمة من خلق الإنسان'},
    // ... more activities
  ];

  const importedLessonIds = new Set(processedLessons.map(l => l.id));
  const processedActivities = activitiesToImport
    .filter(a => importedLessonIds.has(a.lesson_id))
    .map(a => ({
      id: a.activity_id,
      parent_id: a.lesson_id,
      parent_type: 'lesson',
      type_id: typeMap[a.activity_type],
      title: a.title,
      data: JSON.parse(a.content),
      order_index: a.order_index
    }));

  for (const a of processedActivities) {
    const { error } = await supabase.from('activities').upsert(a);
    if (error) console.error(`Error importing activity ${a.id}:`, error.message);
  }

  console.log(`Imported ${processedActivities.length} activities.`);
}

run();
