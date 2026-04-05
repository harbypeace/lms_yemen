import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Upload, AlertCircle, CheckCircle, Loader2, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface BulkImportProps {
  onComplete?: () => void;
}

export const BulkImport: React.FC<BulkImportProps> = ({ onComplete }) => {
  const { activeTenant } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const processCSV = async (text: string) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const users = lines.slice(1).filter(line => line.trim()).map(line => {
      const values = line.split(',').map(v => v.trim());
      const user: any = {};
      headers.forEach((header, i) => {
        user[header] = values[i];
      });
      return user;
    });

    return users;
  };

  const handleImport = async () => {
    if (!file || !activeTenant) return;

    setImporting(true);
    setError(null);
    setResults(null);

    try {
      const text = await file.text();
      const users = await processCSV(text);

      if (users.length === 0) {
        throw new Error('No users found in file');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          users,
          tenantId: activeTenant.id
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Import failed');

      setResults(data.results);
      if (onComplete) onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Upload className="w-5 h-5 text-indigo-600" />
          Bulk Import Users
        </h3>
        <p className="text-slate-500 text-sm mt-1">Upload a CSV file with headers: email, fullName, role, grade</p>
      </div>

      <div className="p-6 space-y-6">
        {!results ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-indigo-300 transition-all cursor-pointer relative group">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="space-y-2">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto text-indigo-600 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-sm font-medium text-slate-900">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </div>
                <p className="text-xs text-slate-500">CSV files only (max 5MB)</p>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-100"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importing Users...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Start Import
                </>
              )}
            </button>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-emerald-900">Import Complete</h4>
                <p className="text-sm text-emerald-700">
                  Successfully imported {results.success} users. {results.errors.length} errors.
                </p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Errors</h5>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                  {results.errors.map((err: any, i: number) => (
                    <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs flex justify-between items-center">
                      <span className="font-bold text-slate-700">{err.email}</span>
                      <span className="text-red-600">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setResults(null);
                setFile(null);
              }}
              className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Import More
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
