import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LearningContent } from './LearningContent';
import { Loader2, Layers, Book, LayoutGrid, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export const LearningContentDemo: React.FC = () => {
  const [data, setData] = useState<{ course?: any, unit?: any, lesson?: any }>({});
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<'course' | 'unit' | 'lesson'>('lesson');

  useEffect(() => {
    async function fetchSampleData() {
      setLoading(true);
      try {
        // Get first course
        const { data: course } = await supabase.from('courses').select('id, title').limit(1).single();
        if (!course) return;

        // Get first unit for that course
        const { data: unit } = await supabase.from('modules').select('id, title').eq('course_id', course.id).limit(1).single();
        
        // Get first lesson for that unit
        let lesson = null;
        if (unit) {
          const { data: l } = await supabase.from('lessons').select('id, title').eq('module_id', unit.id).limit(1).single();
          lesson = l;
        }

        setData({ course, unit, lesson });
      } catch (err) {
        console.error('Demo data fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSampleData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!data.course) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <Info className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900">No Data Available</h3>
        <p className="text-slate-500 mt-2">Please create at least one course with units and lessons to see the multi-level rendering in action.</p>
      </div>
    );
  }

  const levels = [
    { id: 'course', label: 'Course Level', icon: LayoutGrid, targetId: data.course.id, title: data.course.title },
    { id: 'unit', label: 'Unit Level', icon: Layers, targetId: data.unit?.id, title: data.unit?.title },
    { id: 'lesson', label: 'Lesson Level', icon: Book, targetId: data.lesson?.id, title: data.lesson?.title },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-indigo-600 p-8 rounded-3xl text-white">
        <h2 className="text-2xl font-black mb-2">Learning Content Demo</h2>
        <p className="opacity-80">Test how the new LearningContent component aggregates content at different architectural levels.</p>
        
        <div className="flex flex-wrap gap-4 mt-8">
          {levels.map((level) => (
            <button
              key={level.id}
              disabled={!level.targetId}
              onClick={() => setActiveLevel(level.id as any)}
              className={cn(
                "flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all border-2",
                activeLevel === level.id 
                  ? "bg-white text-indigo-600 border-white shadow-xl" 
                  : "bg-indigo-500/30 text-white border-white/20 hover:bg-indigo-500/50",
                !level.targetId && "opacity-30 cursor-not-allowed"
              )}
            >
              <level.icon className="w-5 h-5" />
              {level.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rendering Mode: {activeLevel}</span>
            <h3 className="text-xl font-black text-slate-900">
              {levels.find(l => l.id === activeLevel)?.title || 'Loading...'}
            </h3>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm">
            <Info className="w-4 h-4" />
            {activeLevel === 'course' && "Aggregating all activities from all units & lessons"}
            {activeLevel === 'unit' && "Aggregating all activities from all lessons in this unit"}
            {activeLevel === 'lesson' && "Showing activities for this specific lesson only"}
          </div>
        </div>
        
        <div className="p-8">
          <LearningContent 
            targetId={levels.find(l => l.id === activeLevel)?.targetId || ''} 
            targetType={activeLevel as any}
            unitIndex={activeLevel === 'lesson' || activeLevel === 'unit' ? 0 : undefined}
            lessonIndex={activeLevel === 'lesson' ? 0 : undefined}
          />
        </div>
      </div>
    </div>
  );
};
