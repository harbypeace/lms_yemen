import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Settings, 
  LogOut, 
  GraduationCap,
  ChevronRight,
  School
} from 'lucide-react';
import { motion } from 'motion/react';
import { CourseList } from '../components/CourseList';
import { MemberList } from '../components/MemberList';
import { ProgressTracker } from '../components/ProgressTracker';
import { ParentDashboard } from '../components/ParentDashboard';
import { PermissionsDebugger } from '../components/PermissionsDebugger';
import { cn } from '../lib/utils';

export const Dashboard: React.FC = () => {
  const { profile, activeTenant, memberships, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'courses' | 'members' | 'progress' | 'children'>('dashboard');
  const activeRole = memberships.find(m => m.tenant_id === activeTenant?.id)?.role;

  const stats = [
    { label: 'Active Courses', value: '12', icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Total Students', value: '1,240', icon: Users, color: 'bg-indigo-500' },
    { label: 'Avg. Progress', value: '78%', icon: GraduationCap, color: 'bg-emerald-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
              N
            </div>
            <span className="font-bold text-xl text-slate-900">Nexus</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem 
            icon={BookOpen} 
            label="Courses" 
            active={activeTab === 'courses'} 
            onClick={() => setActiveTab('courses')}
          />
          <SidebarItem 
            icon={Users} 
            label="Members" 
            active={activeTab === 'members'} 
            onClick={() => setActiveTab('members')}
          />
          {activeRole === 'student' && (
            <SidebarItem 
              icon={GraduationCap} 
              label="My Progress" 
              active={activeTab === 'progress'} 
              onClick={() => setActiveTab('progress')}
            />
          )}
          {activeRole === 'parent' && (
            <SidebarItem 
              icon={Users} 
              label="My Children" 
              active={activeTab === 'children'} 
              onClick={() => setActiveTab('children')}
            />
          )}
          <SidebarItem icon={Settings} label="Settings" />
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
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 p-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {activeTab === 'dashboard' ? `Welcome back, ${profile?.full_name?.split(' ')[0] || 'User'}!` : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
            <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
              <School className="w-4 h-4" />
              <span>{activeTenant?.name || 'No School Selected'}</span>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {activeRole || 'No Role'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold">
                  {profile?.full_name?.[0] || 'U'}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {activeTab === 'dashboard' && (
            <>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Recent Courses</h3>
                    <button onClick={() => setActiveTab('courses')} className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="p-4 hover:bg-slate-50 transition-all flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">Advanced Mathematics {item}</h4>
                            <p className="text-sm text-slate-500">12 Lessons • 4 Quizzes</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-all" />
                      </div>
                    ))}
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
            </>
          )}

          {activeTab === 'courses' && <CourseList />}
          
          {activeTab === 'members' && <MemberList />}

          {activeTab === 'progress' && <ProgressTracker />}

          {activeTab === 'children' && <ParentDashboard />}
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
