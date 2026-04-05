import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Supabase Admin Client (using Service Role Key if available, otherwise Anon)
  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    supabaseUrl = 'https://okpruwomwojoshrbdewg.supabase.co';
  }
  
  let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseServiceKey || supabaseServiceKey === 'undefined') {
    supabaseServiceKey = 'sb_publishable_2DaEOu1x78bzJPOkz-lGKA_DNXRfe6v'; // Fallback to anon key
  }
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Middleware to verify Supabase User
  const authenticateUser = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    req.user = user;
    next();
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Create School Action
  app.post('/api/schools', authenticateUser, async (req: any, res: any) => {
    const { name, slug, managerEmail, managerRole } = req.body;
    const userId = req.user.id;

    try {
      // 1. Check if user is General Admin
      const { data: memberships, error: memError } = await supabaseAdmin
        .from('memberships')
        .select('*, tenants!inner(*)')
        .eq('user_id', userId)
        .eq('tenants.slug', 'general')
        .eq('role', 'super_admin');

      if (memError || !memberships || memberships.length === 0) {
        return res.status(403).json({ error: 'Unauthorized: Only General Super Admins can create schools' });
      }

      // 2. Create the school (tenant)
      const { data: newTenant, error: createError } = await supabaseAdmin
        .from('tenants')
        .insert([{ name, slug: slug.toLowerCase().replace(/\s+/g, '-') }])
        .select()
        .single();

      if (createError) throw createError;

      // 3. Add creator as super_admin
      await supabaseAdmin.from('memberships').insert([{
        user_id: userId,
        tenant_id: newTenant.id,
        role: 'super_admin'
      }]);

      // 4. Invite manager if provided
      if (managerEmail) {
        await supabaseAdmin
          .from('invitations')
          .insert([{
            email: managerEmail.toLowerCase(),
            role: managerRole || 'school_admin',
            tenant_id: newTenant.id,
            invited_by: userId
          }]);
      }

      res.status(201).json({ success: true, school: newTenant });
    } catch (err: any) {
      console.error('Error creating school:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Invite Member Action
  app.post('/api/invitations', authenticateUser, async (req: any, res: any) => {
    const { email, role, tenantId } = req.body;
    const userId = req.user.id;

    try {
      // 1. Check if user is Admin of the tenant
      const { data: membership, error: memError } = await supabaseAdmin
        .from('memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (memError || !membership || (membership.role !== 'super_admin' && membership.role !== 'school_admin')) {
        return res.status(403).json({ error: 'Unauthorized: Only admins can invite members' });
      }

      // 2. Create invitation
      const { data: invitation, error: inviteError } = await supabaseAdmin
        .from('invitations')
        .insert([{
          email: email.toLowerCase(),
          role,
          tenant_id: tenantId,
          invited_by: userId
        }])
        .select()
        .single();

      if (inviteError) throw inviteError;

      res.status(201).json({ success: true, invitation });
    } catch (err: any) {
      console.error('Error sending invitation:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create Student Action (for Parents)
  app.post('/api/students', authenticateUser, async (req: any, res: any) => {
    const { username, password, fullName, grade, phone, whatsapp, city, schoolName } = req.body;
    const parentId = req.user.id;

    try {
      // 1. Verify user is a parent
      const { data: parentProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', parentId)
        .single();

      if (profileError || parentProfile?.role !== 'parent') {
        return res.status(403).json({ error: 'Unauthorized: Only parents can create student accounts' });
      }

      // 2. Create user in Supabase Auth
      const dummyEmail = `${username.toLowerCase()}@nexus-internal.com`;
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: dummyEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username: username,
          role: 'student',
        }
      });

      if (authError) throw authError;

      const studentId = authData.user.id;

      // 3. The trigger creates the profile, but we need to update it with the extra fields
      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          grade,
          phone,
          whatsapp,
          city,
          school_name: schoolName,
          parent_id: parentId
        })
        .eq('id', studentId);

      if (updateError) {
        console.error('Error updating student profile:', updateError);
        // Continue anyway, as the user was created
      }

      // 4. Get general tenant ID
      const { data: generalTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', 'general')
        .single();

      if (generalTenant) {
        // 5. Add membership to general tenant
        await supabaseAdmin
          .from('memberships')
          .insert([{
            user_id: studentId,
            tenant_id: generalTenant.id,
            role: 'student'
          }]);

        // 6. Link parent and student
        await supabaseAdmin
          .from('parent_student')
          .insert([{
            parent_id: parentId,
            student_id: studentId,
            tenant_id: generalTenant.id
          }]);
      }

      res.status(201).json({ success: true, studentId });
    } catch (err: any) {
      console.error('Error creating student:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Enroll Action
  app.post('/api/enroll', authenticateUser, async (req: any, res: any) => {
    const { courseId, tenantId, role } = req.body;
    const userId = req.user.id;

    try {
      // 1. Verify user is a member of the tenant
      const { data: membership, error: memError } = await supabaseAdmin
        .from('memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (memError || !membership) {
        return res.status(403).json({ error: 'Unauthorized: You must be a member of this school to enroll' });
      }

      // 2. Check if already enrolled to provide a better error message
      const { data: existing, error: existError } = await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (existing) {
        return res.status(400).json({ error: 'You are already enrolled in this course' });
      }

      // 3. Insert enrollment using admin client (bypasses RLS)
      const { data: enrollment, error: enrollError } = await supabaseAdmin
        .from('enrollments')
        .insert([{
          user_id: userId,
          course_id: courseId,
          tenant_id: tenantId,
          role: role || 'student'
        }])
        .select()
        .single();

      if (enrollError) throw enrollError;

      res.status(201).json({ success: true, enrollment });
    } catch (err: any) {
      console.error('Error enrolling:', err);
      const errorMessage = err.message || err.error_description || 'Unknown error during enrollment';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get My Enrollments and Progress
  app.get('/api/my-enrollments', authenticateUser, async (req: any, res: any) => {
    const { tenantId } = req.query;
    const userId = req.user.id;

    try {
      const [enrollRes, progressRes] = await Promise.all([
        supabaseAdmin
          .from('enrollments')
          .select('course_id')
          .eq('user_id', userId)
          .eq('tenant_id', tenantId),
        supabaseAdmin
          .from('progress')
          .select('lesson_id, completed')
          .eq('user_id', userId)
      ]);
      
      if (enrollRes.error) throw enrollRes.error;
      if (progressRes.error) throw progressRes.error;

      res.json({ 
        success: true, 
        enrollments: enrollRes.data.map(e => e.course_id),
        progress: progressRes.data
      });
    } catch (err: any) {
      console.error('Error fetching enrollments:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get My Enrolled Courses with Progress
  app.get('/api/my-courses', authenticateUser, async (req: any, res: any) => {
    const { tenantId } = req.query;
    const userId = req.user.id;

    try {
      // 1. Get enrollments and courses
      const { data: enrollments, error: enrollError } = await supabaseAdmin
        .from('enrollments')
        .select('course_id, courses(*)')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);
      
      if (enrollError) throw enrollError;

      // 2. For each course, get total lessons and completed lessons
      const coursesWithProgress = await Promise.all(enrollments.map(async (e: any) => {
        const course = e.courses;
        if (!course) return null;

        // Get all lesson IDs for this course
        const { data: modules } = await supabaseAdmin
          .from('modules')
          .select('lessons(id)')
          .eq('course_id', course.id);
        
        const allLessonIds = modules?.flatMap(m => m.lessons.map((l: any) => l.id)) || [];
        const totalLessons = allLessonIds.length;

        // Get completed lessons for this user in this course
        let completedLessons = 0;
        if (totalLessons > 0) {
          const { count } = await supabaseAdmin
            .from('progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('completed', true)
            .in('lesson_id', allLessonIds);
          
          completedLessons = count || 0;
        }

        return {
          ...course,
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          progress_percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
        };
      }));

      res.json({ success: true, courses: coursesWithProgress.filter(Boolean) });
    } catch (err: any) {
      console.error('Error fetching enrolled courses:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create Course Action
  app.post('/api/courses', authenticateUser, async (req: any, res: any) => {
    const { title, description, tenantId } = req.body;
    const userId = req.user.id;

    try {
      // 1. Verify user is admin or teacher
      const { data: membership, error: memError } = await supabaseAdmin
        .from('memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (memError || !membership || !['super_admin', 'school_admin', 'teacher'].includes(membership.role)) {
        return res.status(403).json({ error: 'Unauthorized: Only admins and teachers can create courses' });
      }

      // 2. Create Course
      const { data: courseData, error: courseError } = await supabaseAdmin
        .from('courses')
        .insert({
          title,
          description,
          tenant_id: tenantId
        })
        .select()
        .single();
      
      if (courseError) throw courseError;

      res.status(201).json({ success: true, course: courseData });
    } catch (err: any) {
      console.error('Error creating course:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Generate Demo Action
  app.post('/api/demo', authenticateUser, async (req: any, res: any) => {
    const { tenantId } = req.body;
    const userId = req.user.id;

    try {
      // 1. Verify user is admin or teacher
      const { data: membership, error: memError } = await supabaseAdmin
        .from('memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (memError || !membership || !['super_admin', 'school_admin', 'teacher'].includes(membership.role)) {
        return res.status(403).json({ error: 'Unauthorized: Only admins and teachers can generate demo courses' });
      }

      // 2. Create Course
      const { data: courseData, error: courseError } = await supabaseAdmin
        .from('courses')
        .insert({
          title: 'Gamification Demo Course',
          description: 'A demo course to test XP, levels, and badges.',
          tenant_id: tenantId
        })
        .select()
        .single();
      
      if (courseError) throw courseError;

      // 3. Create Module 1
      const { data: module1, error: module1Error } = await supabaseAdmin
        .from('modules')
        .insert({
          course_id: courseData.id,
          title: 'Introduction to Gamification',
          order_index: 0
        })
        .select()
        .single();
      
      if (module1Error) throw module1Error;

      // 4. Create Welcome Lesson
      const { data: welcomeLesson, error: welcomeError } = await supabaseAdmin
        .from('lessons')
        .insert({
          module_id: module1.id,
          title: 'Welcome to the Platform',
          order_index: 0
        })
        .select()
        .single();

      if (welcomeError) throw welcomeError;

      await supabaseAdmin.from('lesson_blocks').insert({
        lesson_id: welcomeLesson.id,
        type: 'text',
        content_json: { text: '<h1>Welcome!</h1><p>We are excited to have you here. This course will teach you how to use our gamification features.</p>' },
        order_index: 0
      });

      // 5. Create Lesson 1.1
      const { data: lesson1, error: lesson1Error } = await supabaseAdmin
        .from('lessons')
        .insert({
          module_id: module1.id,
          title: 'The Power of XP',
          order_index: 1
        })
        .select()
        .single();

      if (lesson1Error) throw lesson1Error;

      // 5. Create Blocks for Lesson 1.1
      await supabaseAdmin.from('lesson_blocks').insert([
        {
          lesson_id: lesson1.id,
          type: 'video',
          content_json: { video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
          order_index: 0
        },
        {
          lesson_id: lesson1.id,
          type: 'text',
          content_json: { text: 'XP (Experience Points) are the backbone of any gamified system. They provide immediate feedback for effort.' },
          order_index: 1
        },
        {
          lesson_id: lesson1.id,
          type: 'quiz',
          content_json: {
            questions: [
              {
                question: 'What does XP stand for?',
                options: ['X-tra Power', 'Experience Points', 'Xylophone Player', 'Xenon Particle'],
                correctAnswer: 1
              }
            ]
          },
          order_index: 2
        }
      ]);

      // 6. Create Module 2
      const { data: module2, error: module2Error } = await supabaseAdmin
        .from('modules')
        .insert({
          course_id: courseData.id,
          title: 'Advanced Mechanics',
          order_index: 1
        })
        .select()
        .single();
      
      if (module2Error) throw module2Error;

      // 7. Create Lesson 2.1
      const { data: lesson2, error: lesson2Error } = await supabaseAdmin
        .from('lessons')
        .insert({
          module_id: module2.id,
          title: 'Leaderboards and Badges',
          order_index: 0
        })
        .select()
        .single();

      if (lesson2Error) throw lesson2Error;

      // 8. Create Blocks for Lesson 2.1
      await supabaseAdmin.from('lesson_blocks').insert([
        {
          lesson_id: lesson2.id,
          type: 'text',
          content_json: { text: 'Badges are visual representations of achievements. They can be used to signal mastery or participation.' },
          order_index: 0
        },
        {
          lesson_id: lesson2.id,
          type: 'quiz',
          content_json: {
            questions: [
              {
                question: 'Which of these is a common gamification element?',
                options: ['Badges', 'Leaderboards', 'Levels', 'All of the above'],
                correctAnswer: 3
              }
            ]
          },
          order_index: 1
        }
      ]);

      // 9. Create Module 3
      const { data: module3, error: module3Error } = await supabaseAdmin
        .from('modules')
        .insert({
          course_id: courseData.id,
          title: 'Mastery & Beyond',
          order_index: 2
        })
        .select()
        .single();
      
      if (module3Error) throw module3Error;

      // 10. Create Lesson 3.1
      const { data: lesson3, error: lesson3Error } = await supabaseAdmin
        .from('lessons')
        .insert({
          module_id: module3.id,
          title: 'Final Challenge',
          order_index: 0
        })
        .select()
        .single();

      if (lesson3Error) throw lesson3Error;

      await supabaseAdmin.from('lesson_blocks').insert([
        {
          lesson_id: lesson3.id,
          type: 'text',
          content_json: { text: '<h1>Final Quiz</h1><p>Prove your mastery of gamification concepts.</p>' },
          order_index: 0
        },
        {
          lesson_id: lesson3.id,
          type: 'quiz',
          content_json: {
            questions: [
              {
                question: 'What is the primary goal of gamification?',
                options: ['To make everything a game', 'To increase engagement and motivation', 'To replace traditional learning', 'To give out free prizes'],
                correctAnswer: 1
              },
              {
                question: 'Which element provides immediate feedback?',
                options: ['Badges', 'XP', 'Leaderboards', 'Levels'],
                correctAnswer: 1
              }
            ]
          },
          order_index: 1
        }
      ]);

      res.status(201).json({ success: true, course: courseData });
    } catch (err: any) {
      console.error('Error generating demo:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
