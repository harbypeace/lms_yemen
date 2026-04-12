import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { StickyNote, Plus, Trash2, Lock, Globe, Save, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Note {
  id: string;
  content: string;
  is_private: boolean;
  created_at: string;
}

interface NoteSectionProps {
  targetId: string;
  targetType: string;
}

export const NoteSection: React.FC<NoteSectionProps> = ({ targetId, targetType }) => {
  const { user, activeTenant } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && activeTenant) {
      fetchNotes();
    }
  }, [user, activeTenant, targetId, targetType]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('target_id', targetId)
        .eq('target_type', targetType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeTenant || !newNote.trim()) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([{
          user_id: user.id,
          tenant_id: activeTenant.id,
          target_type: targetType,
          target_id: targetId,
          content: newNote,
          is_private: isPrivate
        }])
        .select()
        .single();

      if (error) throw error;
      setNotes([data, ...notes]);
      setNewNote('');
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setNotes(notes.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-indigo-600" />
          Notes & Annotations
        </h3>
      </div>

      <form onSubmit={handleAddNote} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note about this..."
          className="w-full p-4 rounded-xl border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px] text-slate-700 font-medium"
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsPrivate(!isPrivate)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              isPrivate ? "bg-slate-100 text-slate-600" : "bg-indigo-50 text-indigo-600"
            )}
          >
            {isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            {isPrivate ? 'Private Note' : 'Public Note'}
          </button>
          <button
            type="submit"
            disabled={saving || !newNote.trim()}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Note
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-slate-400 font-medium italic">
            No notes yet. Start the conversation!
          </div>
        ) : (
          <AnimatePresence>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {note.is_private ? (
                      <Lock className="w-3 h-3 text-slate-400" />
                    ) : (
                      <Globe className="w-3 h-3 text-indigo-400" />
                    )}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {new Date(note.created_at).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
