'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ── Global keyframe styles ────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.4; transform: scale(0.7); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(12px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    @keyframes toastOut {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    .anim-fade-in    { animation: fadeSlideIn 0.28s ease both; }
    .anim-pulse-dot  { animation: pulseDot 1.8s ease-in-out infinite; }
    .anim-toast-in   { animation: toastIn  0.22s ease both; }
    .anim-toast-out  { animation: toastOut 0.22s ease both; }
  `}</style>
);

// ── Skeleton loader ───────────────────────────────────────────────────────────

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60 ${className}`} />
);

const TableSkeleton = () => (
  <div className="rounded-2xl border border-zinc-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-950 shadow-md overflow-hidden">
    {/* fake header */}
    <div className="border-b-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/60 px-4 py-3 flex gap-4">
      {[120, 60, 80, 80, 120, 70, 70].map((w, i) => (
        <Skeleton key={i} className={`h-4 w-[${w}px] flex-shrink-0`} />
      ))}
    </div>
    {[...Array(4)].map((_, i) => (
      <div key={i} className="px-4 py-3.5 flex gap-4 border-b border-zinc-100 dark:border-zinc-800/60 last:border-b-0">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-lg ml-auto" />
      </div>
    ))}
  </div>
);

// ── Toast notification ────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error';

interface ToastState { message: string; variant: ToastVariant; id: number; exiting?: boolean; }

function Toast({ message, variant, exiting }: Omit<ToastState, 'id'>) {
  const base = 'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl border backdrop-blur-sm';
  const colors = {
    success: 'bg-green-50/95 border-green-200 text-green-800 dark:bg-green-950/90 dark:border-green-800 dark:text-green-300',
    error:   'bg-red-50/95  border-red-200  text-red-800  dark:bg-red-950/90  dark:border-red-800  dark:text-red-300',
  };
  return (
    <div className={`${base} ${colors[variant]} ${exiting ? 'anim-toast-out' : 'anim-toast-in'}`}>
      {variant === 'success' ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      )}
      {message}
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, variant: ToastVariant = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = Date.now();
    setToast({ message, variant, id });
    timerRef.current = setTimeout(() => {
      setToast((prev) => prev?.id === id ? { ...prev, exiting: true } : prev);
      setTimeout(() => setToast(null), 240);
    }, 3000);
  }, []);

  return { toast, show };
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-brand-border/20 bg-white/80 text-zinc-950 shadow-warm dark:border-brand-border-dark/30 dark:bg-[#1C1814]/80 dark:text-zinc-50 backdrop-blur-sm ${className}`}>
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

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'amber' | 'green' | 'destructive' }
>(({ className = '', variant = 'primary', children, ...props }, ref) => {
  const variants: Record<string, string> = {
    primary:     'bg-brand-terracotta text-white hover:bg-brand-terracotta-dark active:brightness-95 shadow-md disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 disabled:shadow-none',
    ghost:       'bg-transparent hover:bg-brand-sand/35 text-zinc-700 dark:hover:bg-brand-warmgray/35 dark:text-zinc-300 disabled:opacity-50',
    outline:     'border border-brand-border/40 bg-transparent hover:bg-brand-sand/20 text-zinc-700 dark:border-brand-border-dark/30 dark:hover:bg-brand-warmgray/20 dark:text-zinc-300 disabled:opacity-50',
    amber:       'bg-status-paused-bg text-status-paused hover:brightness-95 dark:bg-status-paused-bg/10 dark:text-status-paused disabled:opacity-50',
    green:       'bg-status-success-bg text-status-success hover:brightness-95 dark:bg-status-success-bg/10 dark:text-status-success disabled:opacity-50',
    destructive: 'bg-status-failed-red text-white hover:brightness-95 shadow-md disabled:opacity-50',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:ring-offset-2 disabled:pointer-events-none active:scale-95 h-9 px-3 cursor-pointer ${variants[variant]} ${className}`}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});
Button.displayName = 'Button';

const Label = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700 dark:text-zinc-300 leading-none">
    {children}
  </label>
);

const Badge = ({ children, variant }: { children: React.ReactNode; variant: 'green' | 'amber' }) => {
  const styles = {
    green: 'bg-status-success-bg text-status-success border border-status-success/20',
    amber: 'bg-status-paused-bg text-status-paused border border-status-paused/20',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[variant]}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${variant === 'green' ? 'bg-status-success anim-pulse-dot' : 'bg-status-paused'}`} />
      {children}
    </span>
  );
};

const Spinner = ({ className = 'h-4 w-4 text-zinc-400' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── Stat card SVG icons (designed/asymmetric styles) ─────────────────────────

const IconList = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M3 6a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1zm1 5a1 1 0 100 2h16a1 1 0 100-2H4z" clipRule="evenodd" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

const IconPause = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9v6m-4.5-6v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconRetry = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M12 2a10 10 0 00-7.07 17.07l1.41-1.41A8 8 0 1112 20v2a10 10 0 000-20z" />
    <path d="M12 4.5l-4 4h8l-4-4z" />
  </svg>
);

const IconPlay = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
  </svg>
);

const IconPauseBtn = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface Queue {
  id: number;
  projectId: number;
  name: string;
  priority: number;
  concurrencyLimit: number;
  maxRetries: number;
  retryPolicyId: number | null;
  isPaused: boolean;
  createdAt: string;
}

interface RetryPolicy {
  id: number;
  orgId: number;
  name: string;
  type: 'FIXED' | 'LINEAR' | 'EXPONENTIAL';
  baseDelayMs: number;
  maxDelayMs: number | null;
}

// ── Inline editable cell ──────────────────────────────────────────────────────

function EditableNumberCell({
  value,
  onSave,
  onEditingChange,
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  // Mirrors `editing` as a ref so the unmount cleanup can read the live value
  // without a stale closure. If this component unmounts while editing=true
  // (e.g. the queue row is deleted), the cleanup decrements editingCountRef so
  // silent polling is not permanently frozen.
  const editingRef = useRef(false);

  const enterEdit = () => {
    editingRef.current = true;
    setEditing(true);
    setDraft(String(value));
    onEditingChange?.(true);
  };

  const exitEdit = (restoreDraft = true) => {
    editingRef.current = false;
    setEditing(false);
    if (restoreDraft) setDraft(String(value));
    onEditingChange?.(false);
  };

  // Unmount guard: if this cell unmounts while the user is mid-edit, call
  // onEditingChange(false) so editingCountRef in the parent is decremented
  // and silent polling is not permanently suppressed.
  useEffect(() => {
    return () => {
      if (editingRef.current) {
        onEditingChange?.(false);
      }
    };
    // onEditingChange is a stable useCallback ref from the parent — safe to
    // omit from deps. editingRef is a ref, not reactive state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = async () => {
    const parsed = parseInt(draft, 10);
    if (isNaN(parsed) || parsed === value) { exitEdit(); return; }
    setSaving(true);
    try { await onSave(parsed); }
    finally { setSaving(false); exitEdit(false); }
  };

  if (saving) return <span className="flex items-center justify-end gap-1 text-zinc-400"><Spinner className="h-3.5 w-3.5 text-zinc-400" />{value}</span>;

  if (editing) return (
    <input
      autoFocus
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') exitEdit();
      }}
      className="w-20 rounded-lg border border-brand-border/30 bg-transparent px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-terracotta dark:border-brand-border-dark/40"
    />
  );

  return (
    <button
      onClick={enterEdit}
      title="Click to edit"
      className="w-full text-right rounded px-1 py-0.5 hover:bg-brand-sand/30 dark:hover:bg-brand-warmgray/30 cursor-pointer underline decoration-dotted decoration-zinc-300 underline-offset-2 transition-colors"
    >
      {value}
    </button>
  );
}

// ── Create Queue form ─────────────────────────────────────────────────────────

function CreateQueueForm({
  projectId,
  retryPolicies,
  onCreated,
  onCancel,
}: {
  projectId: number;
  retryPolicies: RetryPolicy[];
  onCreated: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('0');
  const [concurrencyLimit, setConcurrencyLimit] = useState('10');
  const [maxRetries, setMaxRetries] = useState('3');
  const [retryPolicyId, setRetryPolicyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          priority: parseInt(priority, 10),
          concurrencyLimit: parseInt(concurrencyLimit, 10),
          maxRetries: parseInt(maxRetries, 10),
          retryPolicyId: retryPolicyId ? parseInt(retryPolicyId, 10) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create queue');
      onCreated(name.trim());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-xl font-serif italic mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        New Queue
      </h3>
      {error && (
        <div className="mb-4 rounded-lg bg-status-failed-bg border border-status-failed/20 p-3 text-sm text-status-failed">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 lg:col-span-3">
          <Label htmlFor="q-name">Queue Name</Label>
          <Input
            id="q-name"
            placeholder="e.g. email-send"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-priority">Priority</Label>
          <Input id="q-priority" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={submitting} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-concurrency">Concurrency Limit</Label>
          <Input id="q-concurrency" type="number" min="1" value={concurrencyLimit} onChange={(e) => setConcurrencyLimit(e.target.value)} disabled={submitting} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-retries">Max Retries</Label>
          <Input id="q-retries" type="number" min="0" value={maxRetries} onChange={(e) => setMaxRetries(e.target.value)} disabled={submitting} />
        </div>
        <div className="space-y-1.5 lg:col-span-3">
          <Label htmlFor="q-policy">Retry Policy</Label>
          <select
            id="q-policy"
            value={retryPolicyId}
            onChange={(e) => setRetryPolicyId(e.target.value)}
            disabled={submitting}
            className="flex h-10 w-full rounded-lg border border-brand-border/30 bg-white/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-terracotta disabled:opacity-50 dark:border-brand-border-dark/40 dark:bg-brand-warmblack/50"
          >
            <option value="">None</option>
            {retryPolicies.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 lg:col-span-3">
          <Button type="submit" disabled={submitting || !name.trim()} className="w-auto px-6">
            {submitting ? <><Spinner className="h-3.5 w-3.5 text-white/70" /> Creating…</> : 'Create Queue'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="w-auto px-5">
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── Main page content ─────────────────────────────────────────────────────────

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const projectId    = searchParams.get('projectId');
  const orgId        = searchParams.get('orgId');

  const [queues, setQueues]                   = useState<Queue[]>([]);
  const [retryPolicies, setRetryPolicies]     = useState<RetryPolicy[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm]   = useState(false);
  const [togglingId, setTogglingId]           = useState<number | null>(null);
  const [contentKey, setContentKey]           = useState(0);
  const [search, setSearch]                   = useState('');

  // Tracks how many EditableNumberCell instances are currently in edit mode.
  // Silent background polls must skip data updates while this count > 0 to
  // prevent overwriting in-progress user edits with stale server values.
  const editingCountRef = useRef(0);
  const handleCellEditingChange = useCallback((isEditing: boolean) => {
    editingCountRef.current += isEditing ? 1 : -1;
  }, []);

  const { toast, show: showToast } = useToast();

  // ── Data fetching (unchanged logic) ────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!projectId) return;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const [queuesRes, policiesRes] = await Promise.all([
        fetch(`/api/queues?projectId=${projectId}`, { credentials: 'include' }),
        orgId
          ? fetch(`/api/retry-policies?orgId=${orgId}`, { credentials: 'include' })
          : Promise.resolve(null),
      ]);
      if (!queuesRes.ok) {
        const d = await queuesRes.json();
        throw new Error(d.error || 'Failed to load queues');
      }
      const queuesData = await queuesRes.json();
      // Guard: skip updating queue data during a silent poll if any cell is
      // currently being edited, to avoid wiping in-progress user edits.
      if (!silent || editingCountRef.current === 0) {
        setQueues(queuesData.data ?? []);
      }
      if (policiesRes && policiesRes.ok) {
        const pd = await policiesRes.json();
        setRetryPolicies(Array.isArray(pd) ? pd : []);
      }
      if (!silent) setContentKey((k) => k + 1);
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId, orgId]);

  useEffect(() => {
    fetchData(false);
    setShowCreateForm(false);
    setSearch('');

    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const policyName = (id: number | null) =>
    id === null ? '—' : retryPolicies.find((p) => p.id === id)?.name ?? 'Unknown';

  const handleTogglePause = async (queue: Queue) => {
    setTogglingId(queue.id);
    try {
      const res = await fetch(`/api/queues/${queue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPaused: !queue.isPaused }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update queue'); }
      setQueues((prev) => prev.map((q) => q.id === queue.id ? { ...q, isPaused: !queue.isPaused } : q));
      showToast(queue.isPaused ? `"${queue.name}" resumed` : `"${queue.name}" paused`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handlePatchField = async (
    queueId: number,
    patch: Partial<Pick<Queue, 'priority' | 'concurrencyLimit' | 'maxRetries'>>
  ) => {
    const res = await fetch(`/api/queues/${queueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update queue'); }
    await fetchData();
  };

  // ── No project selected ───────────────────────────────────────────────────

  if (!projectId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-sand/30 dark:bg-brand-warmgray/30 border border-brand-border/20 dark:border-brand-border-dark/30 shadow-warm">
          <svg className="w-8 h-8 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl font-serif italic mb-2 text-zinc-900 dark:text-zinc-50 font-medium">Pick a project to begin</h2>
          <p className="text-sm text-zinc-500 max-w-sm">Choose a project from the dropdown above to view and manage its queues.</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error && !loading) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400 flex items-start gap-3">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span>
          {error}{' '}
          <button onClick={() => fetchData(false)} className="underline font-semibold cursor-pointer hover:text-red-900 dark:hover:text-red-300">Retry</button>
        </span>
      </div>
    );
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const activeCount = queues.filter((q) => !q.isPaused).length;
  const pausedCount = queues.filter((q) => q.isPaused).length;

  // ── Filtered queues (client-side search) ──────────────────────────────────
  const filteredQueues = queues.filter((q) =>
    q.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Main view ─────────────────────────────────────────────────────────────

  return (
    <div key={contentKey} className="flex flex-col gap-6 anim-fade-in">
      <GlobalStyles />

      {/* Toast */}
      {toast && <Toast message={toast.message} variant={toast.variant} exiting={toast.exiting} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif italic font-medium tracking-tight text-zinc-900 dark:text-zinc-50">Queues</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage execution queues for this project.</p>
        </div>
        {!showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)} className="w-auto px-5 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Queue
          </Button>
        )}
      </div>

      {/* Stats cards (Asymmetric design) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Hero Card: Total Queues (asymmetric, col-span-2) */}
        <div className="col-span-2 rounded-2xl border border-brand-terracotta bg-brand-terracotta text-white p-5 flex items-center justify-between shadow-warm relative overflow-hidden bg-noise">
          <div className="space-y-1 z-10">
            <div className="text-xs font-semibold tracking-wider text-brand-terracotta-light uppercase opacity-90">Total Queues</div>
            <div className="text-4xl font-serif italic font-medium tabular-nums">{queues.length}</div>
          </div>
          <span className="text-white/20 p-2.5 bg-white/10 rounded-xl z-10"><IconList /></span>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
        </div>

        {/* Regular Cards (Asymmetric column widths) */}
        {[
          { label: 'Active Queues',  value: activeCount,          icon: <IconCheck />, border: 'border-brand-border/20 dark:border-brand-border-dark/30', bg: 'bg-white/80 dark:bg-[#1C1814]/80 text-[#3A6647]', iconColor: 'text-[#3A6647] bg-[#EAF2EC] dark:bg-[#3A6647]/10' },
          { label: 'Paused Queues',  value: pausedCount,          icon: <IconPause />, border: 'border-brand-border/20 dark:border-brand-border-dark/30', bg: 'bg-white/80 dark:bg-[#1C1814]/80 text-[#B58428]', iconColor: 'text-[#B58428] bg-[#FAF3E6] dark:bg-[#B58428]/10' },
          { label: 'Retry Policies', value: retryPolicies.length, icon: <IconRetry />, border: 'border-brand-border/20 dark:border-brand-border-dark/30', bg: 'bg-white/80 dark:bg-[#1C1814]/80 text-zinc-500 dark:text-zinc-400', iconColor: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800/50' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border p-4 flex items-center gap-3 shadow-warm bg-noise ${stat.border} ${stat.bg}`}
          >
            <span className={`p-2 rounded-xl flex-shrink-0 ${stat.iconColor}`}>{stat.icon}</span>
            <div>
              <div className="text-2xl font-serif italic font-medium tabular-nums leading-none">{stat.value}</div>
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateQueueForm
          projectId={parseInt(projectId, 10)}
          retryPolicies={retryPolicies}
          onCreated={async (name) => {
            setShowCreateForm(false);
            showToast(`Queue "${name}" created`);
            await fetchData();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Loading skeleton */}
      {loading && <TableSkeleton />}

      {/* Empty state */}
      {!loading && queues.length === 0 && !showCreateForm && (
        <Card className="flex flex-col items-center justify-center py-20 text-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-sand/30 dark:bg-brand-warmgray/30 border border-brand-border/20 dark:border-brand-border-dark/30 shadow-warm">
            <svg className="w-8 h-8 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-serif italic font-medium text-zinc-900 dark:text-zinc-50">Nothing scheduled yet</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm">Establish your first queue to start distributing jobs across your project cluster.</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="w-auto px-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create your first Queue
          </Button>
        </Card>
      )}

      {/* Queue table */}
      {!loading && queues.length > 0 && (
        <Card className="overflow-hidden">
          {/* Search bar */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-3">
            <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Filter queues by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-zinc-400 text-zinc-900 dark:text-zinc-100"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs cursor-pointer">
                Clear
              </button>
            )}
            <span className="text-xs text-zinc-400 tabular-nums">
              {filteredQueues.length}/{queues.length}
            </span>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/60">
                  <th className="text-left   text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Name</th>
                  <th className="text-right  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Priority</th>
                  <th className="text-right  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Concurrency</th>
                  <th className="text-right  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Max Retries</th>
                  <th className="text-left   text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Retry Policy</th>
                  <th className="text-left   text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">
                      No queues match &ldquo;{search}&rdquo;
                    </td>
                  </tr>
                ) : (
                  filteredQueues.map((queue, i) => (
                    <tr
                      key={queue.id}
                      className={`border-b border-brand-border/10 dark:border-brand-border-dark/20 transition-colors duration-150 hover:bg-brand-sand/20 dark:hover:bg-brand-warmgray/10 ${
                        i === filteredQueues.length - 1 ? 'border-b-0' : ''
                      } ${i % 2 !== 0 ? 'bg-brand-cream/20 dark:bg-brand-warmgray/5' : ''}`}
                    >
                      <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{queue.name}</td>
                      <td className="px-4 py-3 text-right">
                        <EditableNumberCell value={queue.priority}        onSave={(v) => handlePatchField(queue.id, { priority: v })} onEditingChange={handleCellEditingChange} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <EditableNumberCell value={queue.concurrencyLimit} onSave={(v) => handlePatchField(queue.id, { concurrencyLimit: v })} onEditingChange={handleCellEditingChange} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <EditableNumberCell value={queue.maxRetries}      onSave={(v) => handlePatchField(queue.id, { maxRetries: v })} onEditingChange={handleCellEditingChange} />
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{policyName(queue.retryPolicyId)}</td>
                      <td className="px-4 py-3">
                        {queue.isPaused ? <Badge variant="amber">Paused</Badge> : <Badge variant="green">Active</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant={queue.isPaused ? 'green' : 'amber'}
                          onClick={() => handleTogglePause(queue)}
                          disabled={togglingId === queue.id}
                          className="w-auto px-3 h-7 text-xs gap-1"
                        >
                          {togglingId === queue.id ? (
                            <><Spinner className="h-3 w-3" /> …</>
                          ) : queue.isPaused ? (
                            <><IconPlay /> Resume</>
                          ) : (
                            <><IconPauseBtn /> Pause</>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col gap-6 pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <TableSkeleton />
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  );
}
