import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { User, Lock, MapPin, Phone, Building, Loader2, Save, Users, GraduationCap, ChevronDown, Zap, Target, CheckCircle, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { DynamicDropdown } from './DynamicDropdown';

export const Settings: React.FC = () => {
  const { user, profile, refreshData, activeTenant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [prefsSuccess, setPrefsSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Adaptive Prefs State
  const [learningPrefs, setLearningPrefs] = useState({
    preferred_style: 'visual',
    difficulty_level: 'intermediate'
  });

  // Notification Prefs State
  const [notificationPrefs, setNotificationPrefs] = useState({
    system_announcements: true,
    course_updates: true,
    new_badges: true,
    parent_alerts: true
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchLearningPrefs();
      fetchNotificationPrefs();
    }
  }, [user]);

  const fetchNotificationPrefs = async () => {
    try {
      const response = await fetch('/api/notification-preferences', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      const data = await response.json();
      if (data && !data.error) {
        setNotificationPrefs({
          system_announcements: data.system_announcements,
          course_updates: data.course_updates,
          new_badges: data.new_badges,
          parent_alerts: data.parent_alerts
        });
      }
    } catch (err) {
      console.error('Error fetching notification prefs:', err);
    }
  };

  const handleNotificationUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setNotifLoading(true);
    try {
      const response = await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(notificationPrefs)
      });
      const data = await response.json();
      if (data.success) {
        setNotifSuccess('Notification preferences updated!');
        setTimeout(() => setNotifSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Error updating notification prefs:', err);
    } finally {
      setNotifLoading(false);
    }
  };

  const fetchLearningPrefs = async () => {
    try {
      const { data } = await supabase
        .from('user_learning_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (data) {
        setLearningPrefs({
          preferred_style: data.preferred_style,
          difficulty_level: data.difficulty_level
        });
      }
    } catch (err) {
      console.error('Error fetching prefs:', err);
    }
  };

  const handlePrefsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setPrefsLoading(true);
    try {
      const { error } = await supabase
        .from('user_learning_preferences')
        .upsert({
          user_id: user.id,
          ...learningPrefs,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setPrefsSuccess('Learning preferences updated!');
      setTimeout(() => setPrefsSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setPrefsLoading(false);
    }
  };

  // Profile Form State
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    phone: '',
    whatsapp: '',
    city: '',
    address: '',
    schoolName: '',
    parentId: '',
    customId: ''
  });

  // Password Form State
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        username: profile.username || '',
        phone: profile.phone || '',
        whatsapp: profile.whatsapp || '',
        city: profile.city || '',
        address: profile.address || '',
        schoolName: profile.school_name || '',
        parentId: profile.parent_id || '',
        // @ts-ignore - custom_id might not be in the type yet
        customId: profile.custom_id || ''
      });
    }
  }, [profile]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

      try {
        const updateData: any = {
          full_name: formData.fullName,
          username: formData.username,
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          city: formData.city,
          address: formData.address,
          school_name: formData.schoolName,
        };

        const { error: updateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id);

        if (updateError) throw updateError;

        // If parentId is provided and they are a student, call link-parent API
        if (profile?.role === 'student' && formData.parentId.trim() && activeTenant) {
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch('/api/link-parent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              parentId: formData.parentId.trim(),
              tenantId: activeTenant.id
            })
          });

          const data = await response.json();
          if (!response.ok) {
             throw new Error(data.error || 'Failed to link with parent');
          }
        } else if (profile?.role === 'student' && !formData.parentId.trim()) {
           // Clear parent_id if empty
           await supabase.from('profiles').update({ parent_id: null }).eq('id', user.id);
        }

      setSuccess('Profile updated successfully!');
      await refreshData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (passwords.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwords.newPassword
      });

      if (updateError) throw updateError;

      setPasswordSuccess('Password updated successfully!');
      setPasswords({ newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'learning' | 'notifications'>('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'learning', label: 'Adaptive Learning', icon: Zap },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Account Settings</h2>
        <p className="text-slate-500 text-sm font-medium">Manage your profile, security, and learning preferences.</p>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-2xl w-fit overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                      <User className="w-5 h-5" />
                    </div>
                    Profile Information
                  </h3>
                </div>
                
                <form onSubmit={handleProfileUpdate} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        {profile?.role === 'student' ? 'Student ID' : 'Parent ID'} (System Generated)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formData.customId}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed font-mono text-sm"
                        placeholder="Generating..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">City</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({...formData, city: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">School Name</label>
                      <div className="relative">
                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={formData.schoolName}
                          onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                          placeholder="Enter school name"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        rows={3}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none"
                        placeholder="Full address"
                      />
                    </div>
                  </div>

                  {profile?.role === 'student' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Link with Parent</label>
                      <DynamicDropdown 
                        type="users" 
                        filterParams={{ tenantId: activeTenant?.id, role: 'parent' }} 
                        value={formData.parentId} 
                        onChange={(val) => setFormData({...formData, parentId: val})} 
                        placeholder="Search for a parent..." 
                      />
                    </div>
                  )}

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-2xl flex items-center gap-2">
                       <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold rounded-2xl flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      {success}
                    </div>
                  )}

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-8 py-3.5 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-indigo-700 transition-all flex items-center gap-3 disabled:opacity-70 shadow-xl shadow-indigo-100"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Update Profile
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
                      <Lock className="w-5 h-5" />
                    </div>
                    Password & Security
                  </h3>
                </div>
                
                <form onSubmit={handlePasswordUpdate} className="p-8 space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">New Password</label>
                    <input
                      type="password"
                      required
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      placeholder="Confirm your password"
                    />
                  </div>

                  {passwordError && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-2xl flex items-center gap-2">
                       <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold rounded-2xl flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      {passwordSuccess}
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-70 shadow-xl shadow-slate-100"
                    >
                      {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Change Password
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'learning' && (
            <motion.div
              key="learning"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-100">
                      <Zap className="w-5 h-5" />
                    </div>
                    Adaptive Learning Intelligence
                  </h3>
                </div>
                
                <form onSubmit={handlePrefsUpdate} className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="block text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <Target className="w-4 h-4 text-indigo-600" />
                        Learning Style
                      </label>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">The AI engine will prioritize content delivery formats that match your psychological learning profile.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {['visual', 'auditory', 'reading', 'kinesthetic'].map(style => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => setLearningPrefs({ ...learningPrefs, preferred_style: style })}
                            className={cn(
                              "px-4 py-3 rounded-2xl border-2 text-xs font-black capitalize transition-all",
                              learningPrefs.preferred_style === style 
                                ? "bg-indigo-50 border-indigo-600 text-indigo-700 scale-105" 
                                : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            )}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="block text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                        Target Difficulty
                      </label>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">Adjust the baseline complexity of the content recommended to you by the adaptive branching engine.</p>
                      <div className="space-y-3">
                        {['beginner', 'intermediate', 'advanced'].map(level => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setLearningPrefs({ ...learningPrefs, difficulty_level: level })}
                            className={cn(
                              "w-full px-5 py-4 rounded-2xl border-2 text-xs font-black capitalize transition-all flex items-center justify-between",
                              learningPrefs.difficulty_level === level 
                                ? "bg-indigo-50 border-indigo-600 text-indigo-700 scale-[1.02]" 
                                : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            )}
                          >
                            {level}
                            {learningPrefs.difficulty_level === level && <CheckCircle className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {prefsSuccess && (
                     <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold rounded-2xl flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        {prefsSuccess}
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={prefsLoading}
                      className="px-8 py-3.5 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-indigo-700 transition-all flex items-center gap-3 disabled:opacity-70 shadow-xl shadow-indigo-100"
                    >
                      {prefsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Sync Intelligence Model
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-lg shadow-indigo-50">
                      <Bell className="w-5 h-5" />
                    </div>
                    Alert Configuration
                  </h3>
                </div>
                
                <form onSubmit={handleNotificationUpdate} className="p-8 space-y-6">
                  <div className="grid gap-4">
                    {[
                      { id: 'system_announcements', label: 'System Announcements', desc: 'Critical platform-wide updates and downtime alerts' },
                      { id: 'course_updates', label: 'Course Updates', desc: 'New modules, curriculum shifts, and content releases' },
                      { id: 'new_badges', label: 'Gamification Alerts', desc: 'Badge earned, leaderboard changes, and XP milestones' },
                      { id: 'parent_alerts', label: 'Academic Alerts', desc: 'Student progress benchmarks and performance warnings' }
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-6 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all group">
                        <div className="space-y-1">
                          <label className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{item.label}</label>
                          <p className="text-xs text-slate-500 font-medium">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNotificationPrefs({ ...notificationPrefs, [item.id]: !notificationPrefs[item.id as keyof typeof notificationPrefs] })}
                          className={cn(
                            "relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none ring-offset-2 focus:ring-2 focus:ring-indigo-500",
                            notificationPrefs[item.id as keyof typeof notificationPrefs] ? "bg-indigo-600 shadow-inner" : "bg-slate-200"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all",
                              notificationPrefs[item.id as keyof typeof notificationPrefs] ? "translate-x-6" : "translate-x-1"
                            )}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  {notifSuccess && (
                     <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold rounded-2xl flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        {notifSuccess}
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={notifLoading}
                      className="px-8 py-3.5 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-indigo-700 transition-all flex items-center gap-3 disabled:opacity-70 shadow-xl shadow-indigo-100"
                    >
                      {notifLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Sync Notification Rules
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
