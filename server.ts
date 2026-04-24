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

  // Startup verification
  console.log('Environment Verification:');
  console.log('- Supabase URL:', process.env.VITE_SUPABASE_URL ? 'Loaded' : 'Missing');
  console.log('- Resend API Key:', process.env.RESEND_API_KEY ? `Loaded (ends with ...${process.env.RESEND_API_KEY.slice(-4)})` : 'Missing');
  console.log('- App URL:', process.env.APP_URL || 'Not set (will use localhost:3000 callback)');

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

  // Email helper (Resend)
  const sendEmail = async ({ to, subject, html }: { to: string, subject: string, html: string }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('RESEND_API_KEY not found. Simulating email send...');
      console.log('To:', to);
      console.log('Subject:', subject);
      return { success: true, simulated: true };
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: 'Nexus LMS <onboarding@resend.dev>',
          to: [to],
          subject,
          html,
        }),
      });
      
      const data = await res.json();
      console.log('Resend API Response:', JSON.stringify(data, null, 2));
      
      // Check if Resend returned an error
      if (data.statusCode && data.statusCode >= 400) {
        console.warn(`Resend Error (${data.statusCode}): ${data.message}`);
        if (data.message?.includes('onboarding@resend.dev')) {
          console.warn('TIP: To send to others, you must verify a domain in Resend. onboarding@resend.dev only allows sending to your own account email.');
        }
      }
      
      return data;
    } catch (err) {
      console.error('Fetch error during email send:', err);
      return { success: false, error: err };
    }
  };

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

  app.get('/api/admin/system/users', authenticateUser, async (req: any, res: any) => {
    const userId = req.user.id;

    try {
      // Verify super_admin role in ANY tenant
      const { data: superAdminMembership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'super_admin');

      if (!superAdminMembership || superAdminMembership.length === 0) {
        return res.status(403).json({ error: 'Unauthorized: Super Admin access required' });
      }

      const { data: users, error } = await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          avatar_url,
          memberships (
            role,
            tenant_id,
            tenants (
              name
            )
          )
        `);

      if (error) throw error;
      res.json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create School Action
  app.post('/api/schools', authenticateUser, async (req: any, res: any) => {
    const { name, slug, managerEmail, managerRole } = req.body;
    const userId = req.user.id;

    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (managerEmail && !emailRegex.test(managerEmail) ) {
      return res.status(400).json({ error: 'A valid email address is required for the manager.' });
    }

    if (!name || !slug) {
      return res.status(400).json({ error: 'School name and slug are required.' });
    }

    // Slug format validation: lowercase letters, numbers, and hyphens
    const slugRegex = /^[a-z0-9-]+$/;
    const cleanSlug = slug.toLowerCase().trim().replace(/\s+/g, '-');
    if (!slugRegex.test(cleanSlug)) {
      return res.status(400).json({ error: 'Slug can only contain lowercase letters, numbers, and hyphens.' });
    }

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

      // Check if slug is already taken
      const { data: existingTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', cleanSlug)
        .single();
      
      if (existingTenant) {
        return res.status(400).json({ error: 'This school slug is already taken. Please choose another.' });
      }

      // 2. Create the school (tenant) - set as pending
      const { data: newTenant, error: createError } = await supabaseAdmin
        .from('tenants')
        .insert([{ 
          name, 
          slug: cleanSlug,
          status: 'pending'
        }])
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
      let invitation = null;
      let temporaryPassword = null;
      let accountCreated = false;

      if (managerEmail) {
        const normalizedEmail = managerEmail.toLowerCase().trim();

        // Check if user already exists in Supabase Auth
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        const users = listData?.users || [];
        const existingAuthUser = users.find((u: any) => u.email === normalizedEmail);

        if (!existingAuthUser && !listError) {
          // Create user with temporary password
          temporaryPassword = Math.random().toString(36).slice(-8) + '!' + Math.floor(Math.random() * 100);
          const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: { 
              role: managerRole || 'school_admin',
              full_name: 'School Manager'
            }
          });

          if (!authError && newUser.user) {
            accountCreated = true;
            // Profiles are usually synced via DB triggers, so we wait for a moment or just proceed
          } else if (authError) {
            console.error('Auth Provisioning Error:', authError);
          }
        }

        const { data: inviteData, error: inviteError } = await supabaseAdmin
          .from('invitations')
          .insert([{
            email: normalizedEmail,
            role: managerRole || 'school_admin',
            tenant_id: newTenant.id,
            invited_by: userId
          }])
          .select()
          .single();
        
        if (!inviteError) {
          invitation = inviteData;
          
          // Send invitation email
          const appUrl = process.env.APP_URL || 'http://localhost:3000';
          const inviteLink = `${appUrl}/accept-invite?id=${invitation.id}`;
          
          let loginInstructions = `
            <p style="color: #64748b; font-size: 14px;">If you don't have an account, you'll be asked to create one first.</p>
          `;

          if (accountCreated && temporaryPassword) {
            loginInstructions = `
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px; margin: 24px 0;">
                <h3 style="margin-top: 0; color: #1e293b;">Your Account is Ready!</h3>
                <p style="font-size: 14px; margin-bottom: 8px;">We've created a temporary account for you. Log in with these credentials after clicking the button above:</p>
                <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: monospace;">
                  <strong>Email:</strong> ${normalizedEmail}<br />
                  <strong>Temp Password:</strong> ${temporaryPassword}
                </div>
                <p style="font-size: 12px; color: #ef4444; margin-top: 12px;"><strong>Important:</strong> You should change your password immediately after logging in.</p>
              </div>
            `;
          }

          await sendEmail({
            to: normalizedEmail,
            subject: `Invitation to manage ${name}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
                <h1 style="color: #4f46e5;">Welcome to ${name}!</h1>
                <p>You have been invited to join <strong>${name}</strong> as a <strong>${managerRole || 'school_admin'}</strong> on Nexus LMS.</p>
                
                <div style="margin: 32px 0; text-align: center;">
                  <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
                </div>

                ${loginInstructions}

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
                <p style="color: #94a3b8; font-size: 12px;">This is an automated message from Nexus LMS. Please do not reply.</p>
              </div>
            `
          });
        }
      }

      res.status(201).json({ 
        success: true, 
        school: newTenant,
        invitation,
        temporaryPassword // Sent back to the super_admin so they can share it manually if needed
      });
    } catch (err: any) {
      console.error('Error creating school:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update School Action
  app.put('/api/schools/:id', authenticateUser, async (req: any, res: any) => {
    const { name, slug } = req.body;
    const { id: schoolId } = req.params;
    const userId = req.user.id;

    try {
      // Verify Admin status in General tenant OR the specific tenant
      const { data: generalMembership } = await supabaseAdmin
        .from('memberships')
        .select('*, tenants!inner(*)')
        .eq('user_id', userId)
        .eq('tenants.slug', 'general')
        .eq('role', 'super_admin')
        .maybeSingle();

      const { data: tenantMembership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', schoolId)
        .in('role', ['super_admin', 'school_admin'])
        .maybeSingle();

      if (!generalMembership && !tenantMembership) {
        return res.status(403).json({ error: 'Unauthorized: Only Admins can manage this school' });
      }

      const { data, error } = await supabaseAdmin
        .from('tenants')
        .update({ 
          name, 
          slug: slug?.toLowerCase().replace(/\s+/g, '-') 
        })
        .eq('id', schoolId)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, school: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete School Action
  app.delete('/api/schools/:id', authenticateUser, async (req: any, res: any) => {
    const { id: schoolId } = req.params;
    const userId = req.user.id;

    try {
      // Verify Super Admin status in General tenant
      const { data: memberships } = await supabaseAdmin
        .from('memberships')
        .select('*, tenants!inner(*)')
        .eq('user_id', userId)
        .eq('tenants.slug', 'general')
        .eq('role', 'super_admin');

      if (!memberships || memberships.length === 0) {
        return res.status(403).json({ error: 'Unauthorized: Only General Super Admins can delete schools' });
      }

      // Check if it's the general tenant (protect from deletion)
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('slug')
        .eq('id', schoolId)
        .single();
      
      if (tenant?.slug === 'general') {
        return res.status(400).json({ error: 'Cannot delete the general management tenant' });
      }

      const { error } = await supabaseAdmin
        .from('tenants')
        .delete()
        .eq('id', schoolId);

      if (error) throw error;
      res.json({ success: true, message: 'School deleted successfully' });
    } catch (err: any) {
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

      // Fetch tenant name for the email
      const { data: tenantContent } = await supabaseAdmin
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .single();
      const schoolName = tenantContent?.name || 'Nexus LMS School';

      // 3. Send invitation email
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const inviteLink = `${appUrl}/accept-invite?id=${invitation.id}`;
      
      await sendEmail({
        to: email.toLowerCase(),
        subject: `Invitation to join ${schoolName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
            <h1 style="color: #4f46e5;">Welcome to ${schoolName}!</h1>
            <p>You have been invited to join <strong>${schoolName}</strong> as a <strong>${role}</strong> on Nexus LMS.</p>
            <div style="margin: 32px 0;">
              <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
            </div>
            <p style="color: #64748b; font-size: 14px;">If you don't have an account, you'll be asked to create one first.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">This is an automated message from Nexus LMS. Please do not reply.</p>
          </div>
        `
      });

      // 4. If user exists, notify them internally
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = usersData?.users?.find((u: any) => u.email === email.toLowerCase());

      if (existingUser) {
        await supabaseAdmin.rpc('create_notification', {
          p_tenant_id: tenantId,
          p_user_id: existingUser.id,
          p_title: 'New Invitation',
          p_message: `You have been invited to join ${schoolName} as a ${role}.`,
          p_type: 'info'
        });
      }

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
      const dummyEmail = username.includes('@') ? username : `${username.toLowerCase()}@nexus-internal.com`;
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

        // 7. Notify student
        await supabaseAdmin.rpc('create_notification', {
          p_tenant_id: generalTenant.id,
          p_user_id: studentId,
          p_title: 'Welcome to Nexus!',
          p_message: `Your account has been created by your parent.`,
          p_type: 'info'
        });
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

      // 2.5 Check prerequisites
      const { data: courseData } = await supabaseAdmin
        .from('courses')
        .select('prerequisites')
        .eq('id', courseId)
        .single();
      
      if (courseData && courseData.prerequisites && courseData.prerequisites.length > 0) {
        const { data: completed } = await supabaseAdmin
          .from('learning_events')
          .select('course_id')
          .eq('user_id', userId)
          .eq('event_type', 'course_completed')
          .in('course_id', courseData.prerequisites);
        
        const completedIds = completed?.map(c => c.course_id) || [];
        const allMet = courseData.prerequisites.every((id: string) => completedIds.includes(id));
        
        if (!allMet && !['super_admin', 'school_admin', 'teacher'].includes(membership.role)) {
          return res.status(403).json({ error: 'Prerequisites not met for this course' });
        }
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

      // 4. Create notification for the user
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single();

      if (course) {
        await supabaseAdmin.rpc('create_notification', {
          p_tenant_id: tenantId,
          p_user_id: userId,
          p_title: 'Course Enrollment',
          p_message: `You have successfully enrolled in ${course.title}.`,
          p_type: 'success',
          p_category: 'course_update'
        });
      }

      res.status(201).json({ success: true, enrollment });
    } catch (err: any) {
      console.error('Error enrolling:', err);
      const errorMessage = err.message || err.error_description || 'Unknown error during enrollment';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Bulk Import Users
  app.post('/api/admin/bulk-import', authenticateUser, async (req: any, res: any) => {
    const { users, tenantId } = req.body;
    const userId = req.user.id;

    try {
      // 1. Check if user is admin of the tenant
      const { data: membership, error: memError } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (memError || !['super_admin', 'school_admin'].includes(membership?.role)) {
        return res.status(403).json({ error: 'Unauthorized: Only admins can perform bulk imports' });
      }

      const results = { success: 0, errors: [] as any[] };

      for (const user of users) {
        try {
          const { email, password, fullName, role, grade } = user;
          
          // Create Auth User
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email.toLowerCase(),
            password: password || 'Nexus123!', // Default password if not provided
            email_confirm: true,
            user_metadata: { full_name: fullName, role: role || 'student' }
          });

          if (authError) throw authError;

          const newUserId = authData.user.id;

          // Update Profile (Trigger creates it, we update)
          await new Promise(resolve => setTimeout(resolve, 200));
          await supabaseAdmin.from('profiles').update({ grade, role: role || 'student' }).eq('id', newUserId);

          // Add Membership
          await supabaseAdmin.from('memberships').insert([{
            user_id: newUserId,
            tenant_id: tenantId,
            role: role || 'student'
          }]);

          results.success++;
        } catch (err: any) {
          results.errors.push({ email: user.email, error: err.message });
        }
      }

      // Log import
      await supabaseAdmin.from('bulk_import_logs').insert([{
        tenant_id: tenantId,
        imported_by: userId,
        total_records: users.length,
        success_count: results.success,
        error_count: results.errors.length,
        errors: results.errors
      }]);

      res.json({ success: true, results });
    } catch (err: any) {
      console.error('Error in bulk import:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // List Parents with Phone Search
  app.get('/api/admin/parents', authenticateUser, async (req: any, res: any) => {
    const { tenantId, phone } = req.query;
    const userId = req.user.id;

    try {
      // Check admin
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!['super_admin', 'school_admin', 'teacher'].includes(membership?.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      let query = supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('role', 'parent');

      if (phone) {
        query = query.ilike('phone', `%${phone}%`);
      }

      const { data: parents, error } = await query.limit(50);
      if (error) throw error;

      res.json({ success: true, parents });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Link Parent and Student
  app.post('/api/admin/link-parent-student', authenticateUser, async (req: any, res: any) => {
    const { parentId, studentId, tenantId } = req.body;
    const userId = req.user.id;

    try {
      // Check admin
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!['super_admin', 'school_admin'].includes(membership?.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Update student profile with parent_id
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ parent_id: parentId })
        .eq('id', studentId);

      if (updateError) throw updateError;

      // Add to parent_student table
      const { error: linkError } = await supabaseAdmin
        .from('parent_student')
        .upsert([{
          parent_id: parentId,
          student_id: studentId,
          tenant_id: tenantId
        }]);

      if (linkError) throw linkError;

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset Password for User
  app.post('/api/admin/reset-password', authenticateUser, async (req: any, res: any) => {
    const { targetUserId, tenantId } = req.body;
    const userId = req.user.id;

    try {
      // Check admin
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!['super_admin', 'school_admin'].includes(membership?.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (!targetUser.user) return res.status(404).json({ error: 'User not found' });

      // Generate password reset link
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetUser.user.email!,
      });

      if (error) throw error;

      res.json({ success: true, resetLink: data.properties.action_link });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create Subscription
  app.post('/api/subscriptions', authenticateUser, async (req: any, res: any) => {
    const { tenantId, planName } = req.body;
    const userId = req.user.id;

    try {
      // Calculate end date (30 days from now for monthly plans)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 30);

      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .insert([{
          user_id: userId,
          tenant_id: tenantId,
          plan_name: planName,
          status: 'active',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, subscription: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Global Leaderboard
  app.get('/api/leaderboard', authenticateUser, async (req: any, res: any) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_stats')
        .select(`
          user_id,
          total_xp,
          level,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .order('total_xp', { ascending: false })
        .limit(10);
      
      if (error) throw error;

      res.json({ success: true, leaderboard: data });
    } catch (err: any) {
      console.error('Error fetching leaderboard:', err);
      res.status(500).json({ error: err.message });
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
          .from('user_progress')
          .select('lesson_id, status')
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
            .from('user_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'completed')
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
    const { title, description, img_url, slug, tenantId, prerequisites = [] } = req.body;
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
          img_url,
          slug,
          tenant_id: tenantId,
          prerequisites
        })
        .select()
        .single();
      
      if (courseError) throw courseError;

      // 3. Notify all students in the tenant
      const { data: students } = await supabaseAdmin
        .from('memberships')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', 'student');

      if (students && students.length > 0) {
        const notifications = students.map(student => ({
          tenant_id: tenantId,
          user_id: student.user_id,
          title: 'New Course Available',
          message: `A new course "${title}" has been added.`,
          type: 'info'
        }));

        await supabaseAdmin
          .from('notifications')
          .insert(notifications);
      }

      res.status(201).json({ success: true, course: courseData });
    } catch (err: any) {
      console.error('Error creating course:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create Module Action
  app.post('/api/modules', authenticateUser, async (req: any, res: any) => {
    const { title, courseId, tenantId, orderIndex, img_url, slug, metadata } = req.body;
    const userId = req.user.id;

    try {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!['super_admin', 'school_admin', 'teacher'].includes(membership?.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { data, error } = await supabaseAdmin
        .from('modules')
        .insert([{
          title,
          course_id: courseId,
          order_index: orderIndex || 0,
          img_url,
          slug,
          metadata: metadata || {}
        }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, module: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create Lesson Action
  app.post('/api/lessons', authenticateUser, async (req: any, res: any) => {
    const { title, moduleId, tenantId, orderIndex, img_url, slug, metadata } = req.body;
    const userId = req.user.id;

    try {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!['super_admin', 'school_admin', 'teacher'].includes(membership?.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { data, error } = await supabaseAdmin
        .from('lessons')
        .insert([{
          title,
          module_id: moduleId,
          order_index: orderIndex || 0,
          img_url,
          slug,
          metadata: metadata || {}
        }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, lesson: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Module Action
  app.put('/api/modules/:id', authenticateUser, async (req: any, res: any) => {
    const { id } = req.params;
    const { title, orderIndex, img_url, slug, metadata, tenantId } = req.body;
    const userId = req.user.id;

    try {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!['super_admin', 'school_admin', 'teacher'].includes(membership?.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { data, error } = await supabaseAdmin
        .from('modules')
        .update({ title, order_index: orderIndex, img_url, slug, metadata })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, module: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Lesson Action
  app.put('/api/lessons/:id', authenticateUser, async (req: any, res: any) => {
    const { id } = req.params;
    const { title, orderIndex, img_url, slug, metadata, tenantId } = req.body;
    const userId = req.user.id;

    try {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!['super_admin', 'school_admin', 'teacher'].includes(membership?.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { data, error } = await supabaseAdmin
        .from('lessons')
        .update({ title, order_index: orderIndex, img_url, slug, metadata })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, lesson: data });
    } catch (err: any) {
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

      // Fetch activity types for mapping
      const { data: types } = await supabaseAdmin.from('activity_types').select('*');
      const typeMap = (types || []).reduce((acc: any, t) => ({ ...acc, [t.name]: t.id }), {});

      // 2. Create Course
      const { data: courseData, error: courseError } = await supabaseAdmin
        .from('courses')
        .insert({
          title: 'Gamification Demo Course',
          description: 'A demo course to test XP, levels, and badges.',
          img_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=60',
          slug: 'gamification-demo-course',
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
          slug: 'intro-to-gamification',
          img_url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=60',
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
          slug: 'welcome-to-platform',
          img_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60',
          order_index: 0
        })
        .select()
        .single();

      if (welcomeError) throw welcomeError;

      await supabaseAdmin.from('activities').insert({
        parent_id: welcomeLesson.id,
        parent_type: 'lesson',
        type_id: typeMap['html'],
        title: 'Welcome Letter',
        data: { html: '<h1>Welcome!</h1><p>We are excited to have you here. This course will teach you how to use our gamification features.</p>' },
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
      await supabaseAdmin.from('activities').insert([
        {
          parent_id: lesson1.id,
          parent_type: 'lesson',
          type_id: typeMap['video'],
          title: 'Introduction Video',
          data: { video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
          order_index: 0
        },
        {
          parent_id: lesson1.id,
          parent_type: 'lesson',
          type_id: typeMap['html'],
          title: 'What is XP?',
          data: { html: 'XP (Experience Points) are the backbone of any gamified system. They provide immediate feedback for effort.' },
          order_index: 1
        },
        {
          parent_id: lesson1.id,
          parent_type: 'lesson',
          type_id: typeMap['quiz'],
          title: 'XP Quiz',
          data: {
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
      await supabaseAdmin.from('activities').insert([
        {
          parent_id: lesson2.id,
          parent_type: 'lesson',
          type_id: typeMap['html'],
          title: 'About Badges',
          data: { html: 'Badges are visual representations of achievements. They can be used to signal mastery or participation.' },
          order_index: 0
        },
        {
          parent_id: lesson2.id,
          parent_type: 'lesson',
          type_id: typeMap['quiz'],
          title: 'Mechanics Knowledge Check',
          data: {
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

      await supabaseAdmin.from('activities').insert([
        {
          parent_id: lesson3.id,
          parent_type: 'lesson',
          type_id: typeMap['html'],
          title: 'Preparation',
          data: { html: '<h1>Final Quiz</h1><p>Prove your mastery of gamification concepts.</p>' },
          order_index: 0
        },
        {
          parent_id: lesson3.id,
          parent_type: 'lesson',
          type_id: typeMap['quiz'],
          title: 'Final Exam',
          data: {
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

      // 11. Notify students
      const { data: students } = await supabaseAdmin
        .from('memberships')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', 'student');

      if (students && students.length > 0) {
        const notifications = students.map(student => ({
          tenant_id: tenantId,
          user_id: student.user_id,
          title: 'Demo Course Available',
          message: `A new demo course has been generated.`,
          type: 'info'
        }));

        await supabaseAdmin
          .from('notifications')
          .insert(notifications);
      }

      res.status(201).json({ success: true, course: courseData });
    } catch (err: any) {
      console.error('Error generating demo:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Unified LMS Event Endpoint
  app.post('/api/events', authenticateUser, async (req: any, res: any) => {
    const { 
      eventType, // 'lesson_completed', 'quiz_passed', etc.
      entityType, // 'lesson', 'quiz', 'course'
      entityId,
      courseId,
      metadata = {},
      tenantId,
      isPublic = false,
      score,
      maxScore,
      duration
    } = req.body;
    const userId = req.user.id;

    try {
      const results: any = {
        xapi: null,
        gamification: null,
        webhooks: []
      };

      // 1. Track xAPI Statement
      let verb: 'start' | 'end' | 'score' | 'store' = 'store';
      if (eventType.includes('start')) verb = 'start';
      else if (eventType.includes('completed') || eventType.includes('passed')) verb = 'end';
      else if (score !== undefined) verb = 'score';

      const xapiParams: any = {
        p_activity_id: entityId || courseId || 'system',
        p_activity_type: entityType,
        p_tenant_id: tenantId,
        p_metadata: metadata,
        p_is_public: isPublic
      };

      if (verb === 'score') {
        xapiParams.p_score = score;
        xapiParams.p_max_score = maxScore || 100;
        const { data: xid } = await supabaseAdmin.rpc('xapi_score', xapiParams);
        results.xapi = xid;
      } else if (verb === 'end') {
        xapiParams.p_success = eventType.includes('passed') || metadata.passed;
        xapiParams.p_completion = true;
        xapiParams.p_duration = duration;
        const { data: xid } = await supabaseAdmin.rpc('xapi_end', xapiParams);
        results.xapi = xid;
      } else {
        xapiParams.p_verb = verb;
        const { data: xid } = await supabaseAdmin.rpc('xapi_store', xapiParams);
        results.xapi = xid;
      }

      // 2. Track Gamification
      const { data: gSuccess, error: gError } = await supabaseAdmin.rpc('track_learning_event', {
        p_user_id: userId,
        p_event_type: eventType,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_course_id: courseId,
        p_metadata: metadata,
        p_org_id: tenantId || userId
      });
      results.gamification = gSuccess;

      // 3. Trigger Webhooks/Integrations
      if (tenantId) {
        const { data: integrations } = await supabaseAdmin
          .from('integrations')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true);

        if (integrations && integrations.length > 0) {
          for (const integration of integrations) {
            // Check if this integration listens to this event type
            const events = integration.events || [];
            if (events.includes(eventType) || events.includes('*')) {
              try {
                const response = await fetch(integration.endpoint_url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(integration.api_key ? { 'Authorization': `Bearer ${integration.api_key}` } : {})
                  },
                  body: JSON.stringify({
                    event: eventType,
                    user_id: userId,
                    entity_type: entityType,
                    entity_id: entityId,
                    course_id: courseId,
                    score,
                    metadata,
                    timestamp: new Date().toISOString()
                  })
                });

                const syncStatus = response.ok ? 'success' : 'failed';
                const responseText = await response.text();
                
                await supabaseAdmin.from('sync_logs').insert([{
                  integration_id: integration.id,
                  event_type: eventType,
                  status: syncStatus,
                  request_payload: req.body,
                  response_payload: { status: response.status, body: responseText },
                  error_message: response.ok ? null : `HTTP Error ${response.status}`
                }]);

                results.webhooks.push({ id: integration.id, status: syncStatus });
              } catch (webhookErr: any) {
                console.error(`Webhook failed for ${integration.name}:`, webhookErr);
                results.webhooks.push({ id: integration.id, status: 'error', error: webhookErr.message });
              }
            }
          }
        }
      }

      res.json({ success: true, results });
    } catch (err: any) {
      console.error('Unified Event Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // xAPI Lite Endpoints
  app.post('/api/xapi/start', authenticateUser, async (req: any, res: any) => {
    const { activityId, activityType, tenantId, metadata, isPublic } = req.body;
    const userId = req.user.id;

    try {
      const { data, error } = await supabaseAdmin.rpc('xapi_start', {
        p_activity_id: activityId,
        p_activity_type: activityType,
        p_tenant_id: tenantId,
        p_metadata: metadata || {},
        p_is_public: isPublic || false
      });

      if (error) throw error;
      res.status(201).json({ success: true, id: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/xapi/end', authenticateUser, async (req: any, res: any) => {
    const { activityId, activityType, success, completion, duration, tenantId, metadata, isPublic } = req.body;
    const userId = req.user.id;

    try {
      const { data, error } = await supabaseAdmin.rpc('xapi_end', {
        p_activity_id: activityId,
        p_activity_type: activityType,
        p_success: success,
        p_completion: completion,
        p_duration: duration,
        p_tenant_id: tenantId,
        p_metadata: metadata || {},
        p_is_public: isPublic || false
      });

      if (error) throw error;
      res.status(201).json({ success: true, id: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/xapi/score', authenticateUser, async (req: any, res: any) => {
    const { activityId, score, maxScore, activityType, tenantId, metadata, isPublic } = req.body;
    const userId = req.user.id;

    try {
      const { data, error } = await supabaseAdmin.rpc('xapi_score', {
        p_activity_id: activityId,
        p_score: score,
        p_max_score: maxScore || 100,
        p_activity_type: activityType,
        p_tenant_id: tenantId,
        p_metadata: metadata || {},
        p_is_public: isPublic || false
      });

      if (error) throw error;
      res.status(201).json({ success: true, id: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/xapi/store', authenticateUser, async (req: any, res: any) => {
    const { activityId, verb, activityType, tenantId, metadata, isPublic } = req.body;
    const userId = req.user.id;

    try {
      const { data, error } = await supabaseAdmin.rpc('xapi_store', {
        p_activity_id: activityId,
        p_verb: verb,
        p_activity_type: activityType,
        p_tenant_id: tenantId,
        p_metadata: metadata || {},
        p_is_public: isPublic || false
      });

      if (error) throw error;
      res.status(201).json({ success: true, id: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/xapi/public', async (req: any, res: any) => {
    const { activityId } = req.query;

    try {
      let query = supabaseAdmin
        .from('xapi_statements')
        .select('*, profiles(full_name, avatar_url)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (activityId) {
        query = query.eq('activity_id', activityId);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      res.json({ success: true, statements: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Integrations & Sync Endpoints
  app.post('/api/integrations', authenticateUser, async (req: any, res: any) => {
    const { name, provider, endpointUrl, apiKey, events, tenantId } = req.body;
    const userId = req.user.id;

    try {
      // Verify admin role
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!membership || !['super_admin', 'school_admin'].includes(membership.role)) {
        return res.status(403).json({ error: 'Unauthorized: Only admins can manage integrations' });
      }

      const { data, error } = await supabaseAdmin
        .from('integrations')
        .insert([{
          name,
          provider,
          endpoint_url: endpointUrl,
          api_key: apiKey,
          events: events || [],
          tenant_id: tenantId,
          created_by: userId
        }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, integration: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sync/trigger', authenticateUser, async (req: any, res: any) => {
    const { integrationId, eventType, payload } = req.body;
    const userId = req.user.id;

    try {
      const { data: integration, error: intError } = await supabaseAdmin
        .from('integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (intError || !integration) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      let syncStatus = 'failed';
      let errorMessage = null;
      let responsePayload = null;

      try {
        // Actual external sync
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (integration.api_key) {
          headers['Authorization'] = `Bearer ${integration.api_key}`;
        }

        const response = await fetch(integration.endpoint_url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            event: eventType,
            data: payload,
            timestamp: new Date().toISOString()
          })
        });

        const responseText = await response.text();
        try {
          responsePayload = JSON.parse(responseText);
        } catch (e) {
          responsePayload = { raw: responseText };
        }

        if (response.ok) {
          syncStatus = 'success';
        } else {
          errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
        }
      } catch (fetchError: any) {
        errorMessage = fetchError.message || 'Connection failed';
      }

      const { data: log, error: logError } = await supabaseAdmin
        .from('sync_logs')
        .insert([{
          integration_id: integrationId,
          event_type: eventType,
          status: syncStatus,
          request_payload: payload,
          response_payload: responsePayload,
          error_message: errorMessage
        }])
        .select()
        .single();

      if (logError) throw logError;

      res.json({ success: syncStatus === 'success', log });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test Webhook Endpoint (For testing integrations)
  app.post('/api/test-webhook', (req: any, res: any) => {
    console.log('Received Test Webhook:', req.body);
    console.log('Headers:', req.headers);
    
    // Simulate processing time
    setTimeout(() => {
      res.status(200).json({ 
        received: true, 
        message: 'Webhook processed successfully',
        echo: req.body 
      });
    }, 500);
  });

  // User Hierarchy Endpoints
  app.get('/api/managed-users', authenticateUser, async (req: any, res: any) => {
    const userId = req.user.id;

    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('parent_id', userId);

      if (error) throw error;
      res.json({ success: true, users: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Notification Preferences Endpoints
  app.get('/api/notification-preferences', authenticateUser, async (req: any, res: any) => {
    const userId = req.user.id;
    try {
      const { data, error } = await supabaseAdmin
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // If no preferences found, return defaults
      if (!data) {
        return res.json({
          system_announcements: true,
          course_updates: true,
          new_badges: true,
          parent_alerts: true
        });
      }

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/notification-preferences', authenticateUser, async (req: any, res: any) => {
    const userId = req.user.id;
    const { system_announcements, course_updates, new_badges, parent_alerts } = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          system_announcements,
          course_updates,
          new_badges,
          parent_alerts,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, preferences: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -- Sub Courses --
  app.post("/api/sub-courses", authenticateUser, async (req, res) => {
    const { title, courseId, tenantId, orderIndex, slug, img_url, metadata } = req.body;
    if (!title || !courseId || !tenantId) return res.status(400).json({ error: "Missing required fields" });

    try {
      const { data, error } = await supabaseAdmin
        .from('sub_courses')
        .insert({
          title,
          course_id: courseId,
          order_index: orderIndex || 0,
          slug: slug || title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
          img_url,
          metadata: metadata || {}
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, subCourse: data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/sub-courses/:id", authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { title, orderIndex, slug, img_url, metadata } = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from('sub_courses')
        .update({
          title,
          order_index: orderIndex,
          slug,
          img_url,
          metadata
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, subCourse: data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/courses-full/:slug", authenticateUser, async (req, res) => {
    const { slug } = req.params;
    
    try {
      // Get course by slug or ID
      const { data: course, error: courseError } = await supabaseAdmin
        .from('courses')
        .select('*')
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .single();

      if (courseError || !course) return res.status(404).json({ error: "Course not found" });

      // Fetch permissions for this course
      const { data: permissions } = await supabaseAdmin
        .from('course_permissions')
        .select('*')
        .eq('course_id', course.id);

      // Get subcourses, modules, and lessons
      const { data: subCourses } = await supabaseAdmin
        .from('sub_courses')
        .select('*, modules(*, lessons(*))')
        .eq('course_id', course.id)
        .order('order_index', { ascending: true });

      // Sort lessons within modules
      const subCoursesWithSortedLessons = subCourses?.map(sc => ({
        ...sc,
        modules: sc.modules.map((m: any) => ({
          ...m,
          lessons: m.lessons.sort((a: any, b: any) => a.order_index - b.order_index)
        }))
      })) || [];

      // Also get modules that don't have a sub_course_id
      const { data: directModules } = await supabaseAdmin
        .from('modules')
        .select('*, lessons(*)')
        .eq('course_id', course.id)
        .is('sub_course_id', null)
        .order('order_index', { ascending: true });

      const directModulesWithSortedLessons = directModules?.map(m => ({
        ...m,
        lessons: m.lessons.sort((a: any, b: any) => a.order_index - b.order_index)
      })) || [];

      res.json({ 
        success: true, 
        course, 
        permissions: permissions || [],
        subCourses: subCoursesWithSortedLessons,
        directModules: directModulesWithSortedLessons
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // -- Course Permissions --
  app.post("/api/courses/:id/permissions", authenticateUser, async (req: any, res: any) => {
    const { id: courseId } = req.params;
    const { role, activityType, canView, canCreate, canUpdate, canDelete, tenantId } = req.body;
    const userId = req.user.id;

    try {
      // Verify admin role
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!membership || !['super_admin', 'school_admin'].includes(membership.role)) {
        return res.status(403).json({ error: 'Unauthorized: Only admins can manage permissions' });
      }

      const { data, error } = await supabaseAdmin
        .from('course_permissions')
        .upsert({
          course_id: courseId,
          role,
          activity_type: activityType,
          can_view: canView,
          can_create: canCreate,
          can_update: canUpdate,
          can_delete: canDelete
        }, {
          onConflict: 'course_id,role,activity_type'
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, permission: data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
