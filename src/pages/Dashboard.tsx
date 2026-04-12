import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Settings as SettingsIcon, 
  LogOut, 
  GraduationCap,
  ChevronRight,
  School,
  Menu,
  X,
  Building2,
  ChevronDown,
  Loader2,
  Trophy,
  Upload,
  CreditCard,
  CheckCircle,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CourseList } from '../components/CourseList';
import { MemberList } from '../components/MemberList';
import { ProgressTracker } from '../components/ProgressTracker';
import { ParentDashboard } from '../components/ParentDashboard';
import { PermissionsDebugger } from '../components/PermissionsDebugger';
import { SchoolManagement } from '../components/SchoolManagement';
import { Settings } from '../components/Settings';
import { GamificationWidget } from '../components/GamificationWidget';
import { GlobalLeaderboard } from '../components/GlobalLeaderboard';
import { UserManagement } from '../components/UserManagement';
import { BulkImport } from '../components/BulkImport';
import { SubscriptionManagement } from '../components/SubscriptionManagement';
import { GamificationOverlay } from '../components/GamificationOverlay';
import { ManagedUsers } from '../components/ManagedUsers';
import { cn } from '../lib/utils';

import { NotificationSystem } from '../components/NotificationSystem';
import { PublicActivityFeed } from '../components/PublicActivityFeed';
import { IntegrationManager } from '../components/IntegrationManager';

export const Dashboard: React.FC = () => {
  const { profile, activeTenant, memberships, setActiveTenant, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'courses' | 'my-courses' | 'members' | 'progress' | 'children' | 'schools' | 'settings' | 'leaderboard' | 'user-management' | 'bulk-import' | 'subscriptions' | 'integrations'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  const activeRole = memberships.find(m => m.tenant_id === activeTenant?.id)?.role;

  const [dashboardStats, setDashboardStats] = useState({ courses: 0, members: 0, progress: 0, enrolledCourses: 0, completedLessons: 0 });
  const [recentCourses, setRecentCourses] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!activeTenant) return;
      setIsLoadingStats(true);

      try {
        // Fetch courses count
        const { count: coursesCount } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', activeTenant.id);

        // Fetch members count
        const { count: membersCount } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', activeTenant.id);

        // Fetch user progress for average
        let userProgress = 0;
        let enrolledCoursesCount = 0;
        let completedLessonsCount = 0;

        if (profile?.id) {
          const { data: userEnrollments } = await supabase
            .from('enrollments')
            .select('course_id')
            .eq('user_id', profile.id)
            .eq('tenant_id', activeTenant.id);
          
          if (userEnrollments && userEnrollments.length > 0) {
            enrolledCoursesCount = userEnrollments.length;
            const courseIds = userEnrollments.map(e => e.course_id);
            const { data: lessons } = await supabase
              .from('lessons')
              .select('id, modules!inner(course_id)')
              .in('modules.course_id', courseIds);
            
            const lessonIds = lessons?.map(l => l.id) || [];
            if (lessonIds.length > 0) {
              const { count: completedCount } = await supabase
                .from('progress')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id)
                .eq('completed', true)
                .in('lesson_id', lessonIds);
              
              completedLessonsCount = completedCount || 0;
              userProgress = Math.round((completedLessonsCount / lessonIds.length) * 100);
            }
          }
        }

        // Fetch recent courses
        const { data: recent } = await supabase
          .from('courses')
          .select('*')
          .eq('tenant_id', activeTenant.id)
          .order('created_at', { ascending: false })
          .limit(3);

        setDashboardStats({
          courses: coursesCount || 0,
          members: membersCount || 0,
          progress: userProgress,
          enrolledCourses: enrolledCoursesCount,
          completedLessons: completedLessonsCount
        });
        setRecentCourses(recent || []);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setIsLoadingStats(false);
      }
    }

    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [activeTenant, activeTab, profile]);

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const stats = activeRole === 'student' ? [
    { label: 'Enrolled Courses', value: dashboardStats.enrolledCourses.toString(), icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Completed Lessons', value: dashboardStats.completedLessons.toString(), icon: CheckCircle, color: 'bg-indigo-500' },
    { label: 'Avg. Progress', value: `${dashboardStats.progress}%`, icon: GraduationCap, color: 'bg-emerald-500' },
  ] : [
    { label: 'Active Courses', value: dashboardStats.courses.toString(), icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Total Members', value: dashboardStats.members.toString(), icon: Users, color: 'bg-indigo-500' },
    { label: 'Avg. Progress', value: `${dashboardStats.progress}%`, icon: GraduationCap, color: 'bg-emerald-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <GamificationOverlay />
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
              N
            </div>
            <span className="font-bold text-xl text-slate-900">Nexus</span>
          </div>
          <button 
            className="md:hidden text-slate-500 hover:bg-slate-100 p-2 rounded-lg"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => handleTabChange('dashboard')}
          />
          {(activeRole === 'super_admin' || activeRole === 'school_admin') && (
            <SidebarItem 
              icon={Building2} 
              label="Schools" 
              active={activeTab === 'schools'} 
              onClick={() => handleTabChange('schools')}
            />
          )}
          {(activeRole === 'super_admin' || activeRole === 'school_admin' || activeRole === 'teacher' || activeRole === 'student') && (
            <>
              <SidebarItem 
                icon={BookOpen} 
                label="All Courses" 
                active={activeTab === 'courses'} 
                onClick={() => handleTabChange('courses')}
              />
              <SidebarItem 
                icon={GraduationCap} 
                label="My Courses" 
                active={activeTab === 'my-courses'} 
                onClick={() => handleTabChange('my-courses')}
              />
              <SidebarItem 
                icon={Trophy} 
                label="Leaderboard" 
                active={activeTab === 'leaderboard'} 
                onClick={() => handleTabChange('leaderboard')}
              />
            </>
          )}
          {(activeRole === 'super_admin' || activeRole === 'school_admin' || activeRole === 'teacher') && (
            <>
              <SidebarItem 
                icon={Users} 
                label="Members" 
                active={activeTab === 'members'} 
                onClick={() => handleTabChange('members')}
              />
              <SidebarItem 
                icon={Users} 
                label="User Management" 
                active={activeTab === 'user-management'} 
                onClick={() => handleTabChange('user-management')}
              />
              {(activeRole === 'super_admin' || activeRole === 'school_admin') && (
                <SidebarItem 
                  icon={Share2} 
                  label="Integrations" 
                  active={activeTab === 'integrations'} 
                  onClick={() => handleTabChange('integrations')}
                />
              )}
            </>
          )}
          {activeRole === 'student' && (
            <>
              <SidebarItem 
                icon={Trophy} 
                label="My Progress" 
                active={activeTab === 'progress'} 
                onClick={() => handleTabChange('progress')}
              />
              <SidebarItem 
                icon={CreditCard} 
                label="Subscription" 
                active={activeTab === 'subscriptions'} 
                onClick={() => handleTabChange('subscriptions')}
              />
            </>
          )}
          {activeRole === 'parent' && (
            <>
              <SidebarItem 
                icon={Users} 
                label="Managed Accounts" 
                active={activeTab === 'children'} 
                onClick={() => handleTabChange('children')}
              />
              <SidebarItem 
                icon={CreditCard} 
                label="Subscription" 
                active={activeTab === 'subscriptions'} 
                onClick={() => handleTabChange('subscriptions')}
              />
            </>
          )}
          <SidebarItem 
            icon={SettingsIcon} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => handleTabChange('settings')}
          />
        </nav>

        <div className="p-4 border-t border-slate-200">
          <button 
            onClick={signOut}
            className="flex items-center gap-3 w-full p-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        <header className="bg-white border-b border-slate-200 p-4 md:p-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                className="flex items-center gap-2 text-left group"
              >
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 truncate max-w-[150px] sm:max-w-xs md:max-w-none">
                    {activeTab === 'dashboard' ? `Welcome back, ${profile?.full_name?.split(' ')[0] || 'User'}!` : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                  </h2>
                  <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm mt-1">
                    <School className="w-3 h-3 md:w-4 md:h-4 hidden sm:block" />
                    <span className="truncate max-w-[100px] sm:max-w-none">{activeTenant?.name || 'No School Selected'}</span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider hidden sm:block">
                      {activeRole || 'No Role'}
                    </span>
                    <ChevronDown className={cn("w-3 h-3 transition-transform", isTenantMenuOpen && "rotate-180")} />
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isTenantMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsTenantMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden"
                    >
                      <div className="p-3 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3">Switch Institution</span>
                      </div>
                      <div className="p-2 space-y-1">
                        {memberships.map((membership) => (
                          <button
                            key={membership.tenant_id}
                            onClick={() => {
                              setActiveTenant(membership.tenants);
                              setIsTenantMenuOpen(false);
                            }}
                            className={cn(
                              "w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group",
                              activeTenant?.id === membership.tenant_id ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            <div>
                              <div className="font-bold text-sm">{membership.tenants.name}</div>
                              <div className="text-[10px] uppercase font-bold opacity-60">{membership.role}</div>
                            </div>
                            {activeTenant?.id === membership.tenant_id && (
                              <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <NotificationSystem />
            <button
              onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                  navigator.clipboard.writeText(session.access_token);
                  alert('JWT Access Token copied to clipboard!');
                } else {
                  alert('No active session found.');
                }
              }}
              className="hidden sm:block text-xs font-semibold text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-full transition-colors"
            >
              Copy JWT
            </button>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-sm md:text-base">
                  {profile?.full_name?.[0] || 'U'}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
          {activeTab === 'dashboard' && activeRole === 'parent' && (
            <ParentDashboard />
          )}

          {activeTab === 'dashboard' && activeRole !== 'parent' && (
            <>
              {activeRole === 'student' && <GamificationWidget />}
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={stat.color + " p-3 rounded-xl text-white shadow-lg shadow-blue-100"}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
                    <div className="text-slate-500 font-medium">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Permissions Debugger */}
              <PermissionsDebugger />

              {/* Recent Activity / Courses */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className={activeRole === 'student' ? "lg:col-span-2 space-y-8" : "lg:col-span-3 space-y-8"}>
                  <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">Recent Courses</h3>
                      <button onClick={() => setActiveTab('courses')} className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {isLoadingStats ? (
                        <div className="p-8 flex justify-center">
                          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                        </div>
                      ) : recentCourses.length > 0 ? (
                        recentCourses.map((course) => (
                          <div key={course.id} className="p-4 hover:bg-slate-50 transition-all flex items-center justify-between group cursor-pointer">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-slate-400" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-900">{course.title}</h4>
                                <p className="text-sm text-slate-500 line-clamp-1">{course.description || 'No description provided'}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-all" />
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-500">
                          No courses found for this school.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">Announcements</h3>
                      <button className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
                    </div>
                    <div className="p-6 space-y-4">
                      {[1, 2].map((item) => (
                        <div key={item} className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                          <h4 className="font-bold text-indigo-900">School Holiday Notice</h4>
                          <p className="text-sm text-indigo-700 mt-1">
                            Please note that the school will be closed next Monday for the national holiday.
                          </p>
                          <span className="text-[10px] font-bold text-indigo-400 uppercase mt-2 block">2 hours ago</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {activeRole === 'student' && (
                  <div className="lg:col-span-1 space-y-8">
                    <GlobalLeaderboard />
                    <PublicActivityFeed />
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'schools' && <SchoolManagement />}

          {activeTab === 'courses' && <CourseList />}
          
          {activeTab === 'my-courses' && <CourseList onlyEnrolled />}
          
          {activeTab === 'members' && <MemberList />}

          {activeTab === 'user-management' && <UserManagement />}

          {activeTab === 'progress' && <ProgressTracker />}

          {activeTab === 'children' && <ManagedUsers />}

          {activeTab === 'subscriptions' && <SubscriptionManagement />}

          {activeTab === 'leaderboard' && <GlobalLeaderboard />}

          {activeTab === 'integrations' && <IntegrationManager />}

          {activeTab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
};

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full p-3 rounded-xl font-medium transition-all",
      active ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
    )}
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </button>
);
