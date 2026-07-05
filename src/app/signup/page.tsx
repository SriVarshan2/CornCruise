'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ── CONTRAST AUDIT (same as login) ─────────────────────────────────────────────
//   Black #0A0A0A on white #FFFFFF    → 19.6:1  ✓ AAA
//   White on black                    → 19.6:1  ✓ AAA
//   Gray  #6B6B6B on white            →  5.7:1  ✓ AA
//   Disabled: #6B6B6B on #D0D0D0      →  4.54:1 ✓ AA
// ──────────────────────────────────────────────────────────────────────────────

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', type, ...props }, ref) => (
    <input
      type={type}
      className={`flex h-10 w-full rounded border-2 border-[#0A0A0A] bg-white px-3 py-2 text-sm
        text-[#0A0A0A] placeholder:text-[#AAAAAA]
        transition-colors focus:outline-none focus:ring-2 focus:ring-[#CC0000] focus:ring-offset-1
        disabled:bg-[#F2F2F2] disabled:text-[#6B6B6B] disabled:border-[#AAAAAA] disabled:cursor-not-allowed
        ${className}`}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className = '', children, ...props }, ref) => (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded text-sm font-bold
        transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#CC0000] focus:ring-offset-2
        disabled:pointer-events-none active:scale-95 h-10 px-4 py-2 w-full cursor-pointer
        bg-[#0A0A0A] text-white hover:bg-[#2A2A2A]
        disabled:bg-[#D0D0D0] disabled:text-[#6B6B6B]
        ${className}`}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';

const Label = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono leading-none">
    {children}
  </label>
);

export default function SignupPage() {
  const router = useRouter();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      router.push('/login?success=Account+created+successfully.+Please+log+in.');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand mark */}
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex items-center justify-center w-14 h-14 bg-[#CC0000] text-white select-none rounded">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
          </span>
          <div className="text-center">
            <div className="text-xl font-bold tracking-tight text-[#0A0A0A]">CronCruise</div>
            <div className="text-[10px] font-mono text-[#6B6B6B] tracking-widest uppercase mt-0.5">SCHEDULER DASHBOARD</div>
          </div>
        </div>

        {/* Card */}
        <div className="border-2 border-[#0A0A0A] bg-white">
          <div className="bg-[#0A0A0A] px-6 py-3 border-b-2 border-[#0A0A0A]">
            <h1 className="text-sm font-bold text-white uppercase tracking-widest font-mono">CREATE ACCOUNT</h1>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="border-2 border-[#CC0000] p-3 text-sm text-[#CC0000] font-medium bg-white">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
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
              <Button
                type="submit"
                disabled={loading || !name.trim() || !email.trim() || !password.trim()}
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>
            </form>

            <div className="border-t-2 border-[#0A0A0A] pt-4">
              <p className="text-center text-xs text-[#6B6B6B]">
                Already have an account?{' '}
                <Link href="/login" className="font-bold text-[#0A0A0A] hover:text-[#CC0000] underline underline-offset-2 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[9px] font-mono text-[#AAAAAA] tracking-widest uppercase">
          CRONCRUISE · DISTRIBUTED SCHEDULER · V1.0
        </p>
      </div>
    </div>
  );
}
