import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    console.error('No SUPABASE_DB_PASSWORD found');
    return;
  }

  const connectionString = `postgresql://postgres:${password}@db.okpruwomwojoshrbdewg.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to Supabase DB.');

    // 1. Ensure General Tenant exists
    const tenantRes = await client.query("SELECT id FROM public.tenants WHERE slug = 'general'");
    if (tenantRes.rows.length === 0) {
      console.log('Creating General tenant...');
      await client.query("INSERT INTO public.tenants (name, slug) VALUES ('General', 'general')");
    } else {
      console.log('General tenant already exists.');
    }

    // 2. Fix Tenants RLS
    console.log('Updating Tenants RLS...');
    await client.query("ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY");
    await client.query("DROP POLICY IF EXISTS \"Authenticated users can view all tenants\" ON public.tenants");
    await client.query(`
      CREATE POLICY "Authenticated users can view all tenants"
      ON public.tenants
      FOR SELECT
      TO authenticated
      USING (true)
    `);

    // 3. Fix Memberships RLS
    console.log('Updating Memberships RLS...');
    await client.query("ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY");
    await client.query("DROP POLICY IF EXISTS \"Users can view their own memberships\" ON public.memberships");
    await client.query("DROP POLICY IF EXISTS \"Users can insert their own memberships\" ON public.memberships");
    await client.query("DROP POLICY IF EXISTS \"Authenticated users can view their own memberships\" ON public.memberships");
    
    await client.query(`
      CREATE POLICY "Users can view their own memberships"
      ON public.memberships
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id)
    `);

    await client.query(`
      CREATE POLICY "Users can insert their own memberships"
      ON public.memberships
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id)
    `);

    // 4. Fix Profiles RLS
    console.log('Updating Profiles RLS...');
    await client.query("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY");
    await client.query("DROP POLICY IF EXISTS \"Users can view their own profile\" ON public.profiles");
    await client.query("DROP POLICY IF EXISTS \"Users can update their own profile\" ON public.profiles");
    
    await client.query(`
      CREATE POLICY "Users can view their own profile"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = id)
    `);

    await client.query(`
      CREATE POLICY "Users can update their own profile"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id)
    `);

    console.log('Database setup complete.');
  } catch (err) {
    console.error('Error during database setup:', err);
  } finally {
    await client.end();
  }
}

setupDatabase();
