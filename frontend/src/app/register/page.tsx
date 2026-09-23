'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/components/dashboard-ui';

interface Plan {
  _id: string;
  name: string;
  price: number;
  billingInterval: 'MONTHLY' | 'YEARLY';
  features: string[];
  isActive: boolean;
}

export default function RegisterPage() {
  const [organizationName, setOrganizationName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch available active plans
  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ['active-plans-register'],
    queryFn: async () => {
      const res = await api.get('/plans/active');
      return res.data;
    },
  });

  const plans = plansData?.plans || [];
  const effectivePlanId = selectedPlanId || (plans.length > 0 ? plans[0]._id : '');

  // Keep selectedPlanId in sync via effect rather than during render
  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0]._id);
    }
  }, [plans, selectedPlanId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!effectivePlanId) {
      setError('Please select a subscription plan to proceed.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register-onboard', {
        organizationName,
        adminName,
        email,
        password,
        planId: effectivePlanId,
      });

      if (response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      } else {
        setError('Checkout session could not be initialized. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Registration failed');
      setLoading(false);
    }
  };

  const isSubmitDisabled = !mounted || loading || plansLoading || !effectivePlanId;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-indigo-600 text-white font-black text-xl mb-4">
            O
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Create your SaaS organization
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Complete your registration and subscribe to get started instantly.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
          {/* Organization & Admin Details */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Organization & Account</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Acme Inc."
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Admin Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Admin Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@acme.com"
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Plan Selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Select Subscription Plan</h2>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <ShieldCheck size={14} className="text-emerald-600" /> Stripe Sandbox Secure
              </span>
            </div>

            {!mounted || plansLoading ? (
              <div className="flex items-center justify-center p-8 text-slate-500 text-sm">
                <Loader2 className="animate-spin mr-2" size={18} /> Loading available plans...
              </div>
            ) : plans.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500 border border-slate-200 rounded-lg">
                No active plans currently available. Please contact support.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {plans.map((plan) => {
                  const isSelected = effectivePlanId === plan._id;
                  return (
                    <div
                      key={plan._id}
                      onClick={() => setSelectedPlanId(plan._id)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 size-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                          <Check size={12} />
                        </div>
                      )}
                      <h3 className="font-bold text-slate-900">{plan.name}</h3>
                      <p className="mt-2 text-2xl font-extrabold text-slate-950">
                        {formatCurrency(plan.price)}
                        <span className="text-xs font-normal text-slate-500 ml-1">
                          /{plan.billingInterval.toLowerCase()}
                        </span>
                      </p>
                      {plan.features?.length > 0 && (
                        <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <Check size={12} className="text-indigo-600 shrink-0" />
                              <span className="truncate">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submission */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 order-2 sm:order-1"
            >
              Already registered? Sign in
            </Link>

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Initializing Checkout...
                </>
              ) : (
                <>
                  Proceed to Secure Checkout <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-500">
          Organizations are only activated after authoritative payment confirmation from Stripe webhooks.
        </p>
      </div>
    </div>
  );
}
