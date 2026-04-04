import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, Membership, Tenant } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  activeTenant: Tenant | null;
  setActiveTenant: (tenant: Tenant | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change event:', event, 'Session:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setProfile(null);
        setMemberships([]);
        setActiveTenant(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const [profileRes, membershipRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('memberships').select('*, tenants(*)').eq('user_id', userId)
      ]);

      if (profileRes.error && profileRes.error.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileRes.error);
      }
      if (profileRes.data) setProfile(profileRes.data);
      
      let userMemberships = membershipRes.data || [];

      // Auto-enroll in General tenant if no memberships exist
      if (userMemberships.length === 0) {
        console.log('No memberships found, checking for General tenant...');
        // 1. Find or create General tenant
        let { data: generalTenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', 'general')
          .single();

        if (!generalTenant) {
          console.log('General tenant not found, creating it...');
          const { data: newTenant, error: createError } = await supabase
            .from('tenants')
            .insert([{ name: 'General', slug: 'general' }])
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating General tenant:', createError);
          } else {
            generalTenant = newTenant;
          }
        }

        if (generalTenant) {
          console.log('Enrolling user in General tenant...');
          const isDefaultAdmin = user?.email === 'lms_yemen@outlook.com';
          
          // Get role from user metadata, default to student if not found
          const userRole = user?.user_metadata?.role || 'student';
          const finalRole = isDefaultAdmin ? 'super_admin' : userRole;

          const { data: newMembership, error: enrollError } = await supabase
            .from('memberships')
            .insert([{ 
              user_id: userId, 
              tenant_id: generalTenant.id, 
              role: finalRole
            }])
            .select('*, tenants(*)')
            .single();

          if (enrollError) {
            console.error('Error enrolling in General tenant:', enrollError);
          } else if (newMembership) {
            userMemberships = [newMembership];
          }
        }
      } else {
        // Check if we need to upgrade lms_yemen@outlook.com to super_admin in general tenant
        const generalMembership = userMemberships.find(m => m.tenants.slug === 'general');
        if (generalMembership && user?.email === 'lms_yemen@outlook.com' && generalMembership.role !== 'super_admin') {
          console.log('Upgrading lms_yemen@outlook.com to super_admin in General tenant...');
          const { data: updatedMembership, error: updateError } = await supabase
            .from('memberships')
            .update({ role: 'super_admin' })
            .eq('id', generalMembership.id)
            .select('*, tenants(*)')
            .single();
          
          if (!updateError && updatedMembership) {
            userMemberships = userMemberships.map(m => m.id === updatedMembership.id ? updatedMembership : m);
          }
        }
      }

      setMemberships(userMemberships);
      
      // Auto-select first tenant if none active
      if (userMemberships.length > 0) {
        setActiveTenant(userMemberships[0].tenants);
      }
    } catch (error) {
      console.error('Unexpected error in fetchUserData:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, memberships, activeTenant, setActiveTenant, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
