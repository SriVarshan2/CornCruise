'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ── Shared design-system primitives ──────────────────────────────────────────

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-brand-border/20 bg-white/80 dark:bg-[#1C1814]/80 text-zinc-950 dark:text-zinc-50 shadow-warm backdrop-blur-sm ${className}`}>
    {children}
  </div>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', type, ...props }, ref) => (
    <input
      type={type}
      className={`flex h-10 w-full rounded-lg border border-brand-border/30 bg-white/50 px-3 py-2 text-sm placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-border-dark/40 dark:bg-brand-warmblack/50 dark:placeholder:text-zinc-500 dark:focus:ring-brand-terracotta ${className}`}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className = '', children, ...props }, ref) => (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:ring-offset-2 disabled:pointer-events-none disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 disabled:shadow-none active:scale-95 bg-brand-terracotta text-white hover:bg-brand-terracotta-dark h-10 px-4 py-2 w-full shadow-md cursor-pointer ${className}`}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';

const Label = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700 dark:text-zinc-300 leading-none">
    {children}
  </label>
);

// ── Page content ──────────────────────────────────────────────────────────────

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    if (success) {
      setSuccessMsg(success);
      const timer = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] bg-noise p-4 dark:bg-[#17140F]">
      {/* Brand mark above card */}
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-terracotta text-white text-xl shadow-warm font-serif italic select-none">⏱</span>
          <span className="text-2xl font-serif italic tracking-tight text-zinc-900 dark:text-zinc-50">CronCruise</span>
        </div>

        <Card className="p-8">
          <div className="mb-6 text-center space-y-1">
            <h1 className="text-3xl font-serif italic tracking-tight font-medium text-zinc-900 dark:text-zinc-50">Welcome back</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Sign in to your account to continue</p>
          </div>

          {successMsg && (
            <div className="mb-4 rounded-lg bg-status-success-bg border border-status-success/20 p-3 text-sm text-status-success">
              {successMsg}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg bg-status-failed-bg border border-status-failed/20 p-3 text-sm text-status-failed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || !email.trim() || !password.trim()}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-brand-terracotta hover:underline dark:text-brand-terracotta-light">
              Create one
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] bg-noise dark:bg-[#17140F]">
        <div className="text-sm text-zinc-500">Loading…</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
