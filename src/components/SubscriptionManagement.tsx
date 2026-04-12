import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CreditCard, CheckCircle, Clock, AlertCircle, Loader2, Plus, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Subscription {
  id: string;
  plan_name: string;
  status: string;
  start_date: string;
  end_date: string | null;
}

const AVAILABLE_PLANS = [
  {
    id: 'basic',
    name: 'Basic Plan',
    price: '$9.99',
    period: '/month',
    features: ['Access to basic courses', 'Community support', 'Standard progress tracking']
  },
  {
    id: 'pro',
    name: 'Pro Plan',
    price: '$19.99',
    period: '/month',
    features: ['All basic features', 'Premium courses', 'Priority support', '1-on-1 mentoring', 'Advanced analytics'],
    popular: true
  }
];

export const SubscriptionManagement: React.FC = () => {
  const { user, activeTenant } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        .eq('tenant_id', activeTenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planName: string) => {
    if (!activeTenant) return;
    setSubscribing(planName);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          planName
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to subscribe');

      await fetchSubscriptions();
      setShowPlans(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubscribing(null);
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
        <button 
          onClick={() => setShowPlans(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-4 h-4" />
          New Subscription
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <CreditCard className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900">No active subscriptions</h3>
          <p className="text-slate-500 mt-2">Subscribe to a plan to unlock premium features and courses.</p>
          <button 
            onClick={() => setShowPlans(true)}
            className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            View Plans
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subscriptions.map((sub) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden"
            >
              {sub.status === 'active' && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -z-10" />
              )}
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  sub.status === 'active' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
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

      {/* Plans Modal */}
      <AnimatePresence>
        {showPlans && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowPlans(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-slate-50 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Choose a Plan</h3>
                  <p className="text-slate-500 text-sm mt-1">Unlock premium features and courses</p>
                </div>
                <button onClick={() => setShowPlans(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-6">
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {AVAILABLE_PLANS.map((plan) => (
                    <div 
                      key={plan.id}
                      className={cn(
                        "bg-white rounded-3xl p-8 border-2 transition-all relative",
                        plan.popular ? "border-indigo-600 shadow-xl shadow-indigo-100" : "border-slate-200 hover:border-indigo-300"
                      )}
                    >
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-200">
                          Most Popular
                        </div>
                      )}
                      <h4 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h4>
                      <div className="flex items-baseline gap-1 mb-6">
                        <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                        <span className="text-slate-500 font-medium">{plan.period}</span>
                      </div>
                      
                      <ul className="space-y-4 mb-8">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3 text-slate-600">
                            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                            <span className="text-sm font-medium">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handleSubscribe(plan.name)}
                        disabled={subscribing !== null}
                        className={cn(
                          "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                          plan.popular 
                            ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100" 
                            : "bg-slate-100 text-slate-900 hover:bg-slate-200",
                          subscribing === plan.name && "opacity-75 cursor-not-allowed"
                        )}
                      >
                        {subscribing === plan.name ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Subscribe Now
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
