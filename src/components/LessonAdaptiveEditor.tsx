import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Settings, Zap, Shield, Target, Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface LessonAdaptiveConfig {
  difficulty: string;
  learning_style: string;
  required_plan: string;
  tags: string[];
}

interface BranchingRule {
  id: string;
  condition_type: string;
  condition_value: any;
  target_lesson_id: string;
  priority: number;
}

interface LessonAdaptiveEditorProps {
  lessonId: string;
  tenantId: string;
}

export const LessonAdaptiveEditor: React.FC<LessonAdaptiveEditorProps> = ({ lessonId, tenantId }) => {
  const [config, setConfig] = useState<LessonAdaptiveConfig>({
    difficulty: 'intermediate',
    learning_style: 'visual',
    required_plan: 'free',
    tags: []
  });
  const [rules, setRules] = useState<BranchingRule[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [lessonId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get Config
      const { data: configData } = await supabase
        .from('lesson_adaptive_config')
        .select('*')
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (configData) setConfig(configData);

      // 2. Get Rules
      const { data: rulesData } = await supabase
        .from('adaptive_branching_rules')
        .select('*')
        .eq('source_lesson_id', lessonId)
        .order('priority', { ascending: false });

      setRules(rulesData || []);

      // 3. Get all lessons in the SAME COURSE for target selection
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('modules(course_id)')
        .eq('id', lessonId)
        .single();
        
      const courseId = (lessonData?.modules as any)?.course_id;

      if (courseId) {
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('id, title, modules!inner(course_id)')
          .eq('modules.course_id', courseId)
          .order('order_index', { ascending: true });

        setLessons(lessonsData || []);
      }
    } catch (err) {
      console.error('Error fetching adaptive data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save Config
      await supabase
        .from('lesson_adaptive_config')
        .upsert({
          lesson_id: lessonId,
          ...config,
          updated_at: new Date().toISOString()
        });

      // Save Rules (Simple delete/re-insert)
      await supabase.from('adaptive_branching_rules').delete().eq('source_lesson_id', lessonId);
      if (rules.length > 0) {
        await supabase.from('adaptive_branching_rules').insert(
          rules.map(r => ({
            tenant_id: tenantId,
            source_lesson_id: lessonId,
            condition_type: r.condition_type,
            condition_value: r.condition_value,
            target_lesson_id: r.target_lesson_id,
            priority: r.priority
          }))
        );
      }
      
      alert('Adaptive settings saved successfully!');
    } catch (err) {
      console.error('Error saving adaptive settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    setRules([...rules, {
      id: Math.random().toString(),
      condition_type: 'score_above',
      condition_value: { threshold: 80 },
      target_lesson_id: '',
      priority: 0
    }]);
  };

  if (loading) return <div className="p-4 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading adaptive settings...</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-600" />
            Content Metadata
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Difficulty</label>
              <select 
                value={config.difficulty}
                onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Learning Style</label>
              <select 
                value={config.learning_style}
                onChange={(e) => setConfig({ ...config, learning_style: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="visual">Visual</option>
                <option value="auditory">Auditory</option>
                <option value="reading">Reading</option>
                <option value="kinesthetic">Kinesthetic</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Required Plan</label>
              <select 
                value={config.required_plan}
                onChange={(e) => setConfig({ ...config, required_plan: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Branching Rules
            </h4>
            <button 
              onClick={addRule}
              className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Rule
            </button>
          </div>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {rules.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No branching rules defined.</p>
            ) : (
              rules.map((rule, idx) => (
                <div key={rule.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 relative group">
                  <button 
                    onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                    className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <select 
                      value={rule.condition_type}
                      onChange={(e) => {
                        const newRules = [...rules];
                        newRules[idx].condition_type = e.target.value;
                        setRules(newRules);
                      }}
                      className="text-[10px] p-1 rounded border border-slate-200"
                    >
                      <option value="score_above">Score Above</option>
                      <option value="score_below">Score Below</option>
                      <option value="preference_match">Style Match</option>
                    </select>
                    <input 
                      type="number"
                      value={rule.condition_value.threshold || 0}
                      onChange={(e) => {
                        const newRules = [...rules];
                        newRules[idx].condition_value = { ...newRules[idx].condition_value, threshold: parseInt(e.target.value) };
                        setRules(newRules);
                      }}
                      className="text-[10px] p-1 rounded border border-slate-200"
                      placeholder="Value"
                    />
                  </div>
                  <select 
                    value={rule.target_lesson_id}
                    onChange={(e) => {
                      const newRules = [...rules];
                      newRules[idx].target_lesson_id = e.target.value;
                      setRules(newRules);
                    }}
                    className="w-full text-[10px] p-1 rounded border border-slate-200"
                  >
                    <option value="">Select Target Lesson</option>
                    {lessons.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-100"
      >
        {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        Save Adaptive Engine Settings
      </button>
    </div>
  );
};
