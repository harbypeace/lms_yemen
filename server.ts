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
