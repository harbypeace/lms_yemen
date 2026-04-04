import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, GraduationCap, MapPin, School, User } from 'lucide-react';
import { motion } from 'motion/react';

export const StudentOnboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'student' | 'parent' | null>(profile?.role as any || null);
  const [grade, setGrade] = useState('');
  const [city, setCity] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedRole) return;
    
    setLoading(true);
    setError(null);

    try {
      // If parent, just update role and complete
      if (selectedRole === 'parent') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'parent' })
          .eq('id', profile.id);

        if (updateError) throw updateError;
        
        // Also update membership in general tenant if it exists
        const { data: generalTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', 'general')
          .single();
          
        if (generalTenant) {
          await supabase
            .from('memberships')
            .update({ role: 'parent' })
            .eq('user_id', profile.id)
            .eq('tenant_id', generalTenant.id);
        }

        onComplete();
        // Force reload to update context
        window.location.reload();
        return;
      }

      // Student flow
      // Validate parent ID if provided
      if (parentId) {
        const { data: parentProfile, error: parentError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', parentId)
          .single();

        if (parentError || !parentProfile) {
          throw new Error('Invalid Parent ID. Please check and try again.');
        }
        if (parentProfile.role !== 'parent') {
          throw new Error('The provided ID does not belong to a parent account.');
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: 'student',
          grade,
          city,
          school_name: schoolName || null,
          parent_id: parentId || null,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Ensure membership is 'student'
      const { data: generalTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', 'general')
        .single();
        
      if (generalTenant) {
        await supabase
          .from('memberships')
          .update({ role: 'student' })
          .eq('user_id', profile.id)
          .eq('tenant_id', generalTenant.id);
      }

      // If parent ID is provided, link them in the parent_student table for the general tenant
      if (parentId && generalTenant) {
        // Check if link already exists
        const { data: existingLink } = await supabase
          .from('parent_student')
          .select('id')
          .eq('parent_id', parentId)
          .eq('student_id', profile.id)
          .eq('tenant_id', generalTenant.id)
          .maybeSingle();

        if (!existingLink) {
          await supabase
            .from('parent_student')
            .insert({
              parent_id: parentId,
              student_id: profile.id,
              tenant_id: generalTenant.id
            });
        }
      }
      
      onComplete();
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
      >
        <div className="p-6 bg-indigo-600 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Welcome to Nexus!</h2>
          <p className="text-indigo-100 mt-1">Let's set up your profile.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {!profile?.role && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">I am a...</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedRole('student')}
                  className={`flex-1 py-2 rounded-xl border font-semibold transition-all ${
                    selectedRole === 'student' 
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('parent')}
                  className={`flex-1 py-2 rounded-xl border font-semibold transition-all ${
                    selectedRole === 'parent' 
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Parent
                </button>
              </div>
            </div>
          )}

          {selectedRole === 'student' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grade Level *</label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    required
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 appearance-none"
                  >
                    <option value="" disabled>Select your grade</option>
                    <option value="1st Grade">1st Grade</option>
                    <option value="2nd Grade">2nd Grade</option>
                    <option value="3rd Grade">3rd Grade</option>
                    <option value="4th Grade">4th Grade</option>
                    <option value="5th Grade">5th Grade</option>
                    <option value="6th Grade">6th Grade</option>
                    <option value="7th Grade">7th Grade</option>
                    <option value="8th Grade">8th Grade</option>
                    <option value="9th Grade">9th Grade</option>
                    <option value="10th Grade">10th Grade</option>
                    <option value="11th Grade">11th Grade</option>
                    <option value="12th Grade">12th Grade</option>
                    <option value="College/University">College/University</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. New York"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">School Name (Optional)</label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. Springfield High"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent ID (Optional)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    placeholder="Ask your parent for their ID"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">This links your account to your parent's dashboard.</p>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading || !selectedRole || (selectedRole === 'student' && (!grade || !city))}
            className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Setup'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
