import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertCircle, Play, FileText, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService, GeneratedCourse } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { GRADES, SUBJECTS } from '../constants';

interface AICourseGeneratorProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const AICourseGenerator: React.FC<AICourseGeneratorProps> = ({ onSuccess, onClose }) => {
  const { activeTenant } = useAuth();
  const [topic, setTopic] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generateCourse = async () => {
    if (!topic || !activeTenant) return;

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setStatus('Designing course structure with AI...');

    try {
      // 1. Generate Structure
      const courseStructure = await geminiService.generateCourseStructure(topic, selectedGrade, selectedSubject);
      setProgress(20);
      setStatus(`Creating course: ${courseStructure.title}`);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // 2. Create Course
      const slug = courseStructure.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      const courseResponse = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: courseStructure.title,
          description: courseStructure.description,
          slug: slug,
          tenantId: activeTenant.id,
          grade: selectedGrade || undefined,
          subject: selectedSubject || undefined
        })
      });

      const courseResult = await courseResponse.json();
      if (!courseResult.success) throw new Error(courseResult.error);
      const courseId = courseResult.course.id;
      
      setProgress(40);

      // Fetch activity types for mapping
      const { data: types } = await supabase.from('activity_types').select('*');
      const typeMap = (types || []).reduce((acc: any, t) => ({ ...acc, [t.name]: t.id }), {});

      // 3. Iterate through Modules
      for (let mIdx = 0; mIdx < courseStructure.modules.length; mIdx++) {
        const moduleData = courseStructure.modules[mIdx];
        setStatus(`Creating module: ${moduleData.title}`);
        
        const moduleResponse = await fetch('/api/modules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            title: moduleData.title,
            courseId,
            tenantId: activeTenant.id,
            orderIndex: mIdx
          })
        });

        const moduleResult = await moduleResponse.json();
        if (!moduleResult.success) throw new Error(moduleResult.error);
        const moduleId = moduleResult.module.id;

        // 4. Iterate through Lessons
        for (let lIdx = 0; lIdx < moduleData.lessons.length; lIdx++) {
          const lessonData = moduleData.lessons[lIdx];
          
          const lessonResponse = await fetch('/api/lessons', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              title: lessonData.title,
              moduleId,
              tenantId: activeTenant.id,
              orderIndex: lIdx
            })
          });

          const lessonResult = await lessonResponse.json();
          if (!lessonResult.success) throw new Error(lessonResult.error);
          const lessonId = lessonResult.lesson.id;

          // 5. Create Activities
          for (let aIdx = 0; aIdx < lessonData.activities.length; aIdx++) {
            const act = lessonData.activities[aIdx];
            
            await supabase.from('activities').insert({
              parent_id: lessonId,
              parent_type: 'lesson',
              type_id: typeMap[act.type],
              title: act.title,
              data: act.data,
              order_index: aIdx
            });
          }
        }
        
        // Update progress incrementally
        setProgress(40 + (mIdx + 1) * (60 / courseStructure.modules.length));
      }

      setStatus('Course generation complete!');
      setProgress(100);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Generation failed:', err);
      setError(err.message);
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">AI Course Architect</h2>
        <p className="text-slate-500">Describe the topic and let AI build the entire course structure for you.</p>
      </div>

      {!isGenerating ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Introduction to Astronomy, Python for Beginners..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Grade</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="">Any Grade</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="">Any Subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={generateCourse}
            disabled={!topic}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Generate Full Course
          </button>
        </div>
      ) : (
        <div className="space-y-6 py-4">
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-indigo-600" 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex items-center gap-3 justify-center text-slate-600 font-medium italic">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            {status}
          </div>
          
          {error && (
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3 mt-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700">Generation Failed</p>
                <p className="text-sm text-red-600">{error}</p>
                <button 
                  onClick={() => setIsGenerating(false)}
                  className="mt-2 text-xs font-bold text-red-700 hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
        Powered by Google Gemini
      </p>
    </div>
  );
};
