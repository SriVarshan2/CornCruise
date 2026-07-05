'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ── Animations ────────────────────────────────────────────────────────────────

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
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes toastOut {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    .anim-fade-in   { animation: fadeSlideIn 0.28s ease both; }
    .anim-pulse-dot  { animation: pulseDot 1.8s ease-in-out infinite; }
    .anim-toast-in   { animation: toastIn 0.22s ease both; }
    .anim-toast-out  { animation: toastOut 0.22s ease both; }
  `}</style>
);

// ── Skeleton ──────────────────────────────────────────────────────────────────

const Skeleton = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60 ${className}`} style={style} />
);

const TableSkeleton = () => (
  <div className="rounded-2xl border border-zinc-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-950 shadow-md overflow-hidden">
    <div className="border-b-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/60 px-4 py-3 flex gap-4">
      {[60, 70, 120, 90, 50, 80, 70].map((w, i) => <Skeleton key={i} className={`h-4`} style={{ width: w }} />)}
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="px-4 py-3.5 flex gap-4 border-b border-zinc-100 dark:border-zinc-800/60 last:border-b-0">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

// ── Toast ─────────────────────────────────────────────────────────────────────

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
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
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

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-brand-border/20 bg-white/80 text-zinc-950 shadow-warm dark:border-brand-border-dark/30 dark:bg-[#1C1814]/80 dark:text-zinc-50 backdrop-blur-sm ${className}`}>{children}</div>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', type, ...props }, ref) => (
    <input type={type} className={`flex h-10 w-full rounded-lg border border-brand-border/30 bg-white/50 px-3 py-2 text-sm placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-border-dark/40 dark:bg-brand-warmblack/50 dark:placeholder:text-zinc-500 dark:focus:ring-brand-terracotta ${className}`} ref={ref} {...props} />
  )
);
Input.displayName = 'Input';

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' }>(
  ({ className = '', variant = 'primary', children, ...props }, ref) => {
    const v: Record<string, string> = {
      primary: 'bg-brand-terracotta text-white hover:bg-brand-terracotta-dark active:brightness-95 shadow-md disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 disabled:shadow-none',
      outline: 'border border-brand-border/40 bg-transparent hover:bg-brand-sand/20 text-zinc-700 dark:border-brand-border-dark/30 dark:hover:bg-brand-warmgray/20 dark:text-zinc-300 disabled:opacity-50',
      ghost:   'bg-transparent hover:bg-brand-sand/35 text-zinc-700 dark:hover:bg-brand-warmgray/35 dark:text-zinc-300 disabled:opacity-50',
    };
    return (
      <button className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:ring-offset-2 disabled:pointer-events-none active:scale-95 h-9 px-3 cursor-pointer ${v[variant]} ${className}`} ref={ref} {...props}>{children}</button>
    );
  }
);
Button.displayName = 'Button';

const Label = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700 dark:text-zinc-300 leading-none">{children}</label>
);

const Spinner = ({ className = 'h-4 w-4 text-zinc-400' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; pulse?: boolean }> = {
    QUEUED:    { bg: 'bg-status-paused-bg text-status-paused border border-status-paused/20', dot: 'bg-status-paused' },
    SCHEDULED: { bg: 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800', dot: 'bg-sky-500' },
    RUNNING:   { bg: 'bg-brand-terracotta-light/40 text-brand-terracotta border border-brand-terracotta/20 dark:bg-brand-terracotta/10 dark:text-brand-terracotta-light', dot: 'bg-brand-terracotta', pulse: true },
    COMPLETED: { bg: 'bg-status-success-bg text-status-success border border-status-success/20', dot: 'bg-status-success' },
    FAILED:    { bg: 'bg-status-failed-bg text-status-failed border border-status-failed/20', dot: 'bg-status-failed' },
  };
  const s = map[status] || map.QUEUED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} ${s.pulse ? 'anim-pulse-dot' : ''}`} />
      {status}
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Queue { id: number; name: string; isPaused: boolean; }
interface Job {
  id: number;
  queueId: number;
  parentJobId: number | null;
  status: string;
  payload: any;
  attempts: number;
  scheduledFor: string;
  cronExpression: string | null;
  createdAt: string;
  updatedAt: string;
}
interface Pagination { page: number; pageSize: number; totalItems: number; totalPages: number; }

// ── Stat icons ────────────────────────────────────────────────────────────────

// ── Stat card SVG icons (designed/asymmetric styles) ─────────────────────────

const IconStack = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M12 2a1 1 0 01.7.3l9 8a1 1 0 010 1.4l-9 8a1 1 0 01-1.4 0l-9-8a1 1 0 010-1.4l9-8A1 1 0 0112 2z" />
    <path opacity="0.6" d="M3 13.5l8.3 7.3a1 1 0 001.4 0l8.3-7.3a1 1 0 111.4 1.4l-9 8a1 1 0 01-1.4 0l-9-8a1 1 0 111.4-1.4z" />
  </svg>
);

const IconClock = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconBolt = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M11.5 2.25a.75.75 0 00-.75.75v8.25h-5a.75.75 0 00-.53 1.28l9.5 9.5a.75.75 0 001.28-.53v-8.25h5a.75.75 0 00.53-1.28l-9.5-9.5a.75.75 0 00-.53-.22z" clipRule="evenodd" />
  </svg>
);

const IconXCircle = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-2.8 11.2a.75.75 0 001.06 1.06l1.74-1.74 1.74 1.74a.75.75 0 001.06-1.06L13.06 12l1.74-1.74a.75.75 0 00-1.06-1.06L12 10.94l-1.74-1.74a.75.75 0 00-1.06 1.06L10.94 12l-1.74 1.74z" clipRule="evenodd" />
  </svg>
);

// ── Create Job form ───────────────────────────────────────────────────────────

function CreateJobForm({
  queueId,
  onCreated,
  onCancel,
}: {
  queueId: number;
  onCreated: (type: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<'immediate' | 'delayed' | 'recurring' | 'batch'>('immediate');
  const [payload, setPayload] = useState('{ "action": "example" }');
  const [delaySeconds, setDelaySeconds] = useState('60');
  const [cronExpression, setCronExpression] = useState('*/5 * * * *');
  const [batchPayloads, setBatchPayloads] = useState('[{ "item": 1 }, { "item": 2 }]');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(null);

    try {
      let body: any = { queueId, type };

      if (type === 'immediate') {
        body.payload = JSON.parse(payload);
      } else if (type === 'delayed') {
        body.payload = JSON.parse(payload);
        body.delaySeconds = parseInt(delaySeconds, 10);
        if (isNaN(body.delaySeconds) || body.delaySeconds <= 0) throw new Error('Delay must be a positive number');
      } else if (type === 'recurring') {
        body.payload = JSON.parse(payload);
        body.cronExpression = cronExpression;
      } else if (type === 'batch') {
        body.payloads = JSON.parse(batchPayloads);
        if (!Array.isArray(body.payloads) || body.payloads.length === 0) throw new Error('Payloads must be a non-empty array');
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create job');
      onCreated(type);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-xl font-serif italic mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        New Job
      </h3>
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">{error}</div>}
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="j-type">Job Type</Label>
          <select
            id="j-type"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            disabled={submitting}
            className="flex h-10 w-full rounded-lg border border-brand-border/30 bg-white/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-terracotta disabled:opacity-50 dark:border-brand-border-dark/40 dark:bg-brand-warmblack/50 cursor-pointer"
          >
            <option value="immediate">Immediate</option>
            <option value="delayed">Delayed</option>
            <option value="recurring">Recurring (Cron)</option>
            <option value="batch">Batch</option>
          </select>
        </div>

        {type !== 'batch' && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="j-payload">Payload (JSON)</Label>
            <textarea
              id="j-payload"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              disabled={submitting}
              rows={3}
              className="flex w-full rounded-lg border border-brand-border/30 bg-white/50 px-3 py-2 text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-terracotta disabled:opacity-50 dark:border-brand-border-dark/40 dark:bg-brand-warmblack/50 resize-y"
            />
          </div>
        )}

        {type === 'batch' && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="j-batch">Payloads (JSON Array)</Label>
            <textarea
              id="j-batch"
              value={batchPayloads}
              onChange={(e) => setBatchPayloads(e.target.value)}
              disabled={submitting}
              rows={3}
              className="flex w-full rounded-lg border border-brand-border/30 bg-white/50 px-3 py-2 text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-terracotta disabled:opacity-50 dark:border-brand-border-dark/40 dark:bg-brand-warmblack/50 resize-y"
            />
          </div>
        )}

        {type === 'delayed' && (
          <div className="space-y-1.5">
            <Label htmlFor="j-delay">Delay (seconds)</Label>
            <Input id="j-delay" type="number" min="1" value={delaySeconds} onChange={(e) => setDelaySeconds(e.target.value)} disabled={submitting} />
          </div>
        )}

        {type === 'recurring' && (
          <div className="space-y-1.5">
            <Label htmlFor="j-cron">Cron Expression</Label>
            <Input id="j-cron" placeholder="*/5 * * * *" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} disabled={submitting} />
          </div>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={submitting} className="w-auto px-6">
            {submitting ? <><Spinner className="h-3.5 w-3.5 text-white/70" /> Creating…</> : 'Create Job'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="w-auto px-5">Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

// ── Main page content ─────────────────────────────────────────────────────────

function JobsPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const orgId = searchParams.get('orgId');

  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingQueues, setLoadingQueues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const { toast, show: showToast } = useToast();

  // Fetch queues for selector
  useEffect(() => {
    if (!projectId) return;
    setLoadingQueues(true);
    fetch(`/api/queues?projectId=${projectId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const qs = d.data ?? [];
        setAllQueues(qs);
        if (qs.length > 0 && !selectedQueueId) setSelectedQueueId(String(qs[0].id));
      })
      .catch(() => {})
      .finally(() => setLoadingQueues(false));
  }, [projectId]);

  // Fetch jobs for selected queue
  const fetchJobs = useCallback(async (page = 1, silent = false) => {
    if (!selectedQueueId) return;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const params = new URLSearchParams({ queueId: selectedQueueId, page: String(page), pageSize: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/jobs?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to load jobs'); }
      const d = await res.json();
      setJobs(d.data ?? []);
      setPagination(d.pagination);
      setCurrentPage(page);
      if (!silent) setContentKey((k) => k + 1);
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedQueueId, statusFilter]);

  useEffect(() => {
    fetchJobs(1, false);
    setShowCreateForm(false);
    setSearch('');

    const interval = setInterval(() => {
      fetchJobs(currentPage, true);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchJobs, currentPage]);

  // Truncate payload for display
  const truncPayload = (p: any) => {
    const s = typeof p === 'string' ? p : JSON.stringify(p);
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return d; }
  };

  // Filter by search (client-side on ID or payload text)
  const filteredJobs = jobs.filter((j) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return String(j.id).includes(q) || JSON.stringify(j.payload).toLowerCase().includes(q);
  });

  // Stats
  const totalJobs = pagination.totalItems;
  const queuedCount = jobs.filter((j) => j.status === 'QUEUED' || j.status === 'SCHEDULED').length;
  const runningCount = jobs.filter((j) => j.status === 'RUNNING').length;
  const failedCount = jobs.filter((j) => j.status === 'FAILED').length;

  const selectedQueue = allQueues.find((q) => String(q.id) === selectedQueueId);

  // ── No project selected ───────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-sand/30 dark:bg-brand-warmgray/30 border border-brand-border/20 dark:border-brand-border-dark/30 shadow-warm">
          <svg className="w-8 h-8 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
        </div>
        <div>
          <h2 className="text-3xl font-serif italic mb-2 text-zinc-900 dark:text-zinc-50">Pick a project to begin</h2>
          <p className="text-sm text-zinc-500 max-w-sm">Choose a project from the dropdown above to view jobs.</p>
        </div>
      </div>
    );
  }

  // Loading queues
  if (loadingQueues) {
    return (
      <div className="flex-1 flex flex-col gap-4 pt-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        <TableSkeleton />
      </div>
    );
  }

  // No queues at all
  if (allQueues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-5">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <svg className="w-7 h-7 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold">No queues in this project</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-xs">Create a queue first on the Queues tab, then come back to manage jobs.</p>
        </div>
      </div>
    );
  }

  return (
    <div key={contentKey} className="flex flex-col gap-6 anim-fade-in">
      <GlobalStyles />
      {toast && <Toast message={toast.message} variant={toast.variant} exiting={toast.exiting} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl font-serif italic font-medium tracking-tight text-zinc-900 dark:text-zinc-50">Jobs</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Queue</span>
            <select
              value={selectedQueueId}
              onChange={(e) => setSelectedQueueId(e.target.value)}
              className="h-8 rounded-lg border border-brand-border/30 bg-white/50 px-2 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-terracotta dark:border-brand-border-dark/40 dark:bg-[#1A1612]/50 text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              {allQueues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
        </div>
        {!showCreateForm && selectedQueueId && (
          <Button onClick={() => setShowCreateForm(true)} className="w-auto px-5 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            New Job
          </Button>
        )}
      </div>

      {/* Stats (Asymmetric layout) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Hero Card: Total Jobs (asymmetric, col-span-2) */}
        <div className="col-span-2 rounded-2xl border border-brand-terracotta bg-brand-terracotta text-white p-5 flex items-center justify-between shadow-warm relative overflow-hidden bg-noise">
          <div className="space-y-1 z-10">
            <div className="text-xs font-semibold tracking-wider text-brand-terracotta-light uppercase opacity-90">Total Jobs</div>
            <div className="text-4xl font-serif italic font-medium tabular-nums">{totalJobs}</div>
          </div>
          <span className="text-white/20 p-2.5 bg-white/10 rounded-xl z-10"><IconStack /></span>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
        </div>

        {/* Regular Cards (Asymmetric column widths) */}
        {[
          { label: 'Queued',  value: queuedCount,  icon: <IconClock />, border: 'border-brand-border/20 dark:border-brand-border-dark/30', bg: 'bg-white/80 dark:bg-[#1C1814]/80 text-[#B58428]', iconColor: 'text-[#B58428] bg-[#FAF3E6] dark:bg-[#B58428]/10' },
          { label: 'Running', value: runningCount, icon: <IconBolt />,  border: 'border-brand-border/20 dark:border-brand-border-dark/30', bg: 'bg-white/80 dark:bg-[#1C1814]/80 text-brand-terracotta', iconColor: 'text-brand-terracotta bg-brand-terracotta-light/30 dark:bg-brand-terracotta/10' },
          { label: 'Failed',  value: failedCount,  icon: <IconXCircle />, border: 'border-brand-border/20 dark:border-brand-border-dark/30', bg: 'bg-white/80 dark:bg-[#1C1814]/80 text-[#A64B4B]', iconColor: 'text-[#A64B4B] bg-[#FDF3F3] dark:bg-[#A64B4B]/10' },
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
      {showCreateForm && selectedQueueId && (
        <CreateJobForm
          queueId={parseInt(selectedQueueId, 10)}
          onCreated={(type) => {
            setShowCreateForm(false);
            showToast(`${type} job created`);
            fetchJobs(1);
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400 flex items-start gap-3">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span>{error} <button onClick={() => fetchJobs(currentPage)} className="underline font-semibold cursor-pointer">Retry</button></span>
        </div>
      )}

      {/* Loading */}
      {loading && <TableSkeleton />}

      {/* Empty */}
      {!loading && !error && jobs.length === 0 && !showCreateForm && (
        <Card className="flex flex-col items-center justify-center py-20 text-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-sand/30 dark:bg-brand-warmgray/30 border border-brand-border/20 dark:border-brand-border-dark/30 shadow-warm">
            <svg className="w-8 h-8 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.43 9.75" /></svg>
          </div>
          <div>
            <h2 className="text-2xl font-serif italic font-medium text-zinc-900 dark:text-zinc-50">No execution records</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm">No jobs have been scheduled on the &ldquo;{selectedQueue?.name}&rdquo; queue yet.</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="w-auto px-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Create your first Job
          </Button>
        </Card>
      )}

      {/* Table */}
      {!loading && !error && jobs.length > 0 && (
        <Card className="overflow-hidden">
          {/* Search + status filter */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-3 flex-wrap">
            <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input
              type="text"
              placeholder="Filter by ID or payload…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[120px] text-sm bg-transparent focus:outline-none placeholder:text-zinc-400 text-zinc-900 dark:text-zinc-100"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-7 rounded-md border border-brand-border/30 bg-white/50 text-xs font-medium px-2 focus:outline-none focus:ring-2 focus:ring-brand-terracotta dark:border-brand-border-dark/40 dark:bg-brand-warmblack/50 cursor-pointer"
            >
              <option value="">All statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="RUNNING">Running</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
            <span className="text-xs text-zinc-400 tabular-nums">{filteredJobs.length}/{jobs.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/60">
                  <th className="text-right text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">ID</th>
                  <th className="text-left  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Payload</th>
                  <th className="text-left  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Scheduled For</th>
                  <th className="text-right text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Attempts</th>
                  <th className="text-left  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-400">No jobs match your filter.</td></tr>
                ) : filteredJobs.map((job, i) => (
                  <tr
                    key={job.id}
                    className={`border-b border-brand-border/10 dark:border-brand-border-dark/20 transition-colors duration-150 hover:bg-brand-sand/20 dark:hover:bg-brand-warmgray/10 ${i === filteredJobs.length - 1 ? 'border-b-0' : ''} ${i % 2 !== 0 ? 'bg-brand-cream/20 dark:bg-brand-warmgray/5' : ''}`}
                  >
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500 font-mono text-xs">{job.id}</td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate" title={JSON.stringify(job.payload)}>{truncPayload(job.payload)}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{formatDate(job.scheduledFor)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{job.attempts}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{formatDate(job.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                Page {currentPage} of {pagination.totalPages} · {pagination.totalItems} total
              </span>
              <div className="flex gap-1.5">
                <Button variant="outline" disabled={currentPage <= 1} onClick={() => fetchJobs(currentPage - 1)} className="h-7 px-2.5 text-xs">
                  ← Prev
                </Button>
                <Button variant="outline" disabled={currentPage >= pagination.totalPages} onClick={() => fetchJobs(currentPage + 1)} className="h-7 px-2.5 text-xs">
                  Next →
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col gap-6 pt-2">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        <TableSkeleton />
      </div>
    }>
      <JobsPageContent />
    </Suspense>
  );
}
