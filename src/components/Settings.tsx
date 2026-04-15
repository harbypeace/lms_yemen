import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { User, Lock, MapPin, Phone, Building, Loader2, Save, Users, GraduationCap, ChevronDown, Zap, Target, CheckCircle, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export const Settings: React.FC = () => {
  const { user, profile, refreshData } = useAuth();
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

  const [parents, setParents] = useState<any[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);

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

  useEffect(() => {
    const fetchParents = async () => {
      if (profile?.role !== 'student') return;
      
      setLoadingParents(true);
      try {
        // Get current tenant ID
        const { data: membership } = await supabase
          .from('memberships')
          .select('tenant_id')
          .eq('user_id', user?.id)
          .single();

        if (membership) {
          const { data: parentMemberships } = await supabase
            .from('memberships')
            .select(`
              user_id,
              profiles:user_id (
                full_name,
                custom_id
              )
            `)
            .eq('tenant_id', membership.tenant_id)
            .eq('role', 'parent');

          if (parentMemberships) {
            setParents(parentMemberships.map((m: any) => ({
              id: m.user_id,
              name: m.profiles.full_name,
              customId: m.profiles.custom_id
            })));
          }
        }
      } catch (err) {
        console.error('Error fetching parents:', err);
      } finally {
        setLoadingParents(false);
      }
    };

    if (user && profile?.role === 'student') {
      fetchParents();
    }
  }, [user, profile]);

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

        // Only include parent_id if it's a valid UUID string, otherwise null
        if (profile?.role === 'student') {
          updateData.parent_id = formData.parentId.trim() || null;
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id);

        if (updateError) throw updateError;

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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Account Settings</h2>
        <p className="text-slate-500 text-sm">Manage your profile information and security settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Profile Information
              </h3>
            </div>
            
            <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {profile?.role === 'student' ? 'Student ID' : 'Parent ID'} (System Generated)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formData.customId}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-mono text-sm"
                    placeholder="Generating..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">School Name</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="Enter school name"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    rows={3}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    placeholder="Full address"
                  />
                </div>
              </div>

              {profile?.role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Parent</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={formData.parentId}
                      onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                    >
                      <option value="">No Parent Linked</option>
                      {parents.map(parent => (
                        <option key={parent.id} value={parent.id}>
                          {parent.name} ({parent.customId})
                        </option>
                      ))}
                    </select>
                    {loadingParents && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      </div>
                    )}
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-lg">
                  {success}
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Profile
                </button>
              </div>
            </form>
          </motion.div>

          {/* Learning Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Adaptive Learning Engine
              </h3>
            </div>
            
            <form onSubmit={handlePrefsUpdate} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600" />
                    Learning Style
                  </label>
                  <p className="text-xs text-slate-500 mb-3">The engine will prioritize content matching your style.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['visual', 'auditory', 'reading', 'kinesthetic'].map(style => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setLearningPrefs({ ...learningPrefs, preferred_style: style })}
                        className={cn(
                          "px-3 py-2 rounded-xl border-2 text-xs font-bold capitalize transition-all",
                          learningPrefs.preferred_style === style 
                            ? "bg-indigo-50 border-indigo-600 text-indigo-700" 
                            : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                        )}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    Preferred Difficulty
                  </label>
                  <p className="text-xs text-slate-500 mb-3">Adjust the initial difficulty of recommended lessons.</p>
                  <div className="space-y-2">
                    {['beginner', 'intermediate', 'advanced'].map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setLearningPrefs({ ...learningPrefs, difficulty_level: level })}
                        className={cn(
                          "w-full px-4 py-2 rounded-xl border-2 text-xs font-bold capitalize transition-all flex items-center justify-between",
                          learningPrefs.difficulty_level === level 
                            ? "bg-indigo-50 border-indigo-600 text-indigo-700" 
                            : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
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
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-lg">
                  {prefsSuccess}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={prefsLoading}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-70 shadow-lg shadow-indigo-100"
                >
                  {prefsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Preferences
                </button>
              </div>
            </form>
          </motion.div>

          {/* Notification Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                Notification Preferences
              </h3>
            </div>
            
            <form onSubmit={handleNotificationUpdate} className="p-6 space-y-6">
              <div className="space-y-4">
                {[
                  { id: 'system_announcements', label: 'System Announcements', desc: 'Important updates about the platform' },
                  { id: 'course_updates', label: 'Course Updates', desc: 'New lessons, module releases, and content changes' },
                  { id: 'new_badges', label: 'New Badges & Achievements', desc: 'Get notified when you earn a new badge or level up' },
                  { id: 'parent_alerts', label: 'Parent Alerts', desc: 'Updates about your students progress (Parents only)' }
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                    <div>
                      <label className="font-bold text-slate-900 block">{item.label}</label>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotificationPrefs({ ...notificationPrefs, [item.id]: !notificationPrefs[item.id as keyof typeof notificationPrefs] })}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        notificationPrefs[item.id as keyof typeof notificationPrefs] ? "bg-indigo-600" : "bg-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          notificationPrefs[item.id as keyof typeof notificationPrefs] ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {notifSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-lg">
                  {notifSuccess}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={notifLoading}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-70 shadow-lg shadow-indigo-100"
                >
                  {notifLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Preferences
                </button>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Security Settings */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                Security
              </h3>
            </div>
            
            <form onSubmit={handlePasswordUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="••••••••"
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-lg">
                  {passwordSuccess}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
