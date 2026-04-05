import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CreditCard, CheckCircle, Clock, AlertCircle, Loader2, Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface Subscription {
  id: string;
  plan_name: string;
  status: string;
  start_date: string;
  end_date: string | null;
}

export const SubscriptionManagement: React.FC = () => {
  const { user, activeTenant } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && activeTenant) {
      fetchSubscriptions();
    }
  }, [user, activeTenant]);

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('tenant_id', activeTenant?.id);

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Loading subscriptions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">My Subscriptions</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
          <Plus className="w-4 h-4" />
          New Subscription
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <CreditCard className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900">No active subscriptions</h3>
          <p className="text-slate-500 mt-2">Subscribe to a plan to unlock premium features and courses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subscriptions.map((sub) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  sub.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                )}>
                  {sub.status}
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-1">{sub.plan_name}</h3>
              <p className="text-slate-500 text-sm mb-6">Billed monthly</p>

              <div className="space-y-3 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Started on
                  </span>
                  <span className="font-bold text-slate-900">{new Date(sub.start_date).toLocaleDateString()}</span>
                </div>
                {sub.end_date && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Expires on
                    </span>
                    <span className="font-bold text-slate-900">{new Date(sub.end_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
