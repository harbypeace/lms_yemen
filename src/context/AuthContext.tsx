import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, Membership, Tenant } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  activeTenant: Tenant | null;
  setActiveTenant: (tenant: Tenant | null) => void;
  enrollments: Record<string, boolean>;
  setEnrollments: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  progress: Record<string, boolean>;
  setProgress: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshData: () => Promise<void>;
  fetchEnrollments: (userId: string, tenantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [enrollments, setEnrollments] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const refreshData = async () => {
    if (user) {
      await fetchUserData(user.id);
      if (activeTenant) {
        await fetchEnrollments(user.id, activeTenant.id);
      }
    }
  };

  const fetchEnrollments = async (userId: string, tenantId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/my-enrollments?tenantId=${tenantId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        const enrollMap: Record<string, boolean> = {};
        data.enrollments.forEach((id: string) => enrollMap[id] = true);
        setEnrollments(enrollMap);

        const progressMap: Record<string, boolean> = {};
        data.progress.forEach((p: any) => progressMap[p.lesson_id] = p.completed);
        setProgress(progressMap);
      }
    } catch (err) {
      console.error('Error fetching enrollments via API:', err);
    }
  };

  useEffect(() => {
    if (user && activeTenant) {
      fetchEnrollments(user.id, activeTenant.id);

      // Real-time listener for enrollments
      const enrollmentSubscription = supabase
        .channel('enrollment-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'enrollments',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchEnrollments(user.id, activeTenant.id);
          }
        )
        .subscribe();
      
      // Real-time listener for progress
      const progressSubscription = supabase
        .channel('progress-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'progress',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchEnrollments(user.id, activeTenant.id);
          }
        )
        .subscribe();

      // Real-time listener for profile (XP/Points)
      const profileSubscription = supabase
        .channel('profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            setProfile(payload.new as Profile);
          }
        )
        .subscribe();

      return () => {
        enrollmentSubscription.unsubscribe();
        progressSubscription.unsubscribe();
        profileSubscription.unsubscribe();
      };
    }
  }, [user?.id, activeTenant?.id]);

  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change event:', event, 'Session:', !!session);
      
      // Only update if session actually changed to avoid loops
      setSession(prev => {
        if (prev?.access_token === session?.access_token) return prev;
        return session;
      });
      
      setUser(prev => {
        if (prev?.id === session?.user?.id) return prev;
        return session?.user ?? null;
      });
      
      if (!session) {
        setProfile(null);
        setMemberships([]);
        setActiveTenant(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserData(user.id);
    }
  }, [user?.id]);

  const fetchUserData = async (userId: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    console.log('Fetching user data for:', userId);
    try {
      const [profileRes, membershipRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('memberships').select('*, tenants(*)').eq('user_id', userId)
      ]);

      if (profileRes.error) {
        console.error('Error fetching profile:', profileRes.error);
      }
      if (profileRes.data) setProfile(profileRes.data);
      
      let userMemberships = membershipRes.data || [];

      // Find General tenant membership
      let generalMembership = userMemberships.find(m => m.tenants?.slug === 'general');

      // Auto-enroll in General tenant if not already a member
      if (!generalMembership) {
        console.log('General membership not found, checking for General tenant...');
        
        const { data: generalTenant, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', 'general')
          .maybeSingle();

        if (tenantError) {
          console.error('Error finding General tenant:', tenantError);
        }

        if (generalTenant) {
          console.log('Enrolling user in General tenant...');
          const admins = ['lms_yemen@outlook.com', 'halmontaser1@gmail.com'];
          const isDefaultAdmin = admins.includes(user?.email || '');
          
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
            .maybeSingle();

          if (enrollError) {
            console.error('Error enrolling in General tenant:', enrollError);
          } else if (newMembership) {
            userMemberships = [...userMemberships, newMembership];
            generalMembership = newMembership;
          }
        } else {
          console.warn('General tenant not found. Please ensure it is created by an admin.');
        }
      }

      // Check if we need to upgrade admins to super_admin in general tenant
      const admins = ['lms_yemen@outlook.com', 'halmontaser1@gmail.com'];
      if (generalMembership && admins.includes(user?.email || '') && generalMembership.role !== 'super_admin') {
        console.log('Upgrading admin to super_admin in General tenant...');
        const { data: updatedMembership, error: updateError } = await supabase
          .from('memberships')
          .update({ role: 'super_admin' })
          .eq('id', generalMembership.id)
          .select('*, tenants(*)')
          .maybeSingle();
        
        if (!updateError && updatedMembership) {
          userMemberships = userMemberships.map(m => m.id === updatedMembership.id ? updatedMembership : m);
        }
      }

      setMemberships(userMemberships);
      
      // Prefer General tenant as active if available
      const preferredTenant = userMemberships.find(m => m.tenants?.slug === 'general')?.tenants || userMemberships[0]?.tenants;
      if (preferredTenant) {
        setActiveTenant(preferredTenant);
        // Fetch enrollments for the preferred tenant
        await fetchEnrollments(userId, preferredTenant.id);
      }
    } catch (error) {
      console.error('Unexpected error in fetchUserData:', error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      memberships, 
      activeTenant, 
      setActiveTenant, 
      enrollments,
      setEnrollments,
      progress,
      setProgress,
      fetchEnrollments,
      loading, 
      signOut, 
      refreshData 
    }}>
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
