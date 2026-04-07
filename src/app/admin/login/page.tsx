'use client';

import { useState } from 'react';
import Link from 'next/link';

import { signInWithPassword } from '@/app/auth/actions';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      formData.append('next', '/dashboard/admin');

      await signInWithPassword(formData);
      // The action will redirect if successful
    } catch {
      setError('Invalid email or password');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-stone-50 to-stone-100">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-stone-200 bg-white p-8 shadow-lg">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-stone-900">Admin Panel</h1>
            <p className="mt-2 text-stone-600">Super Admin Dashboard Login</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-stone-900">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm placeholder-stone-400 focus:border-teal-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-stone-900">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm placeholder-stone-400 focus:border-teal-500 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal-600 py-3 font-bold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 border-t border-stone-200 pt-6 text-center">
            <p className="text-sm text-stone-600">
              Don&apos;t have an admin account? Ask the super admin to run the secure setup flow with
              a one-time setup token.
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link href="/" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
              ← Back to App
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
