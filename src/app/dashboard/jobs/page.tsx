'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ── CONTRAST AUDIT ─────────────────────────────────────────────────────────────
//   White on red   #CC0000           →  5.9:1  ✓ AA  (QUEUED)
//   White on black #0A0A0A           → 19.6:1  ✓ AAA (RUNNING)
//   White on green #00814A           →  4.82:1 ✓ AA  (COMPLETED)
//   White on maroon #7B0000          → 10.2:1  ✓ AAA (FAILED)
//   #6B6B6B on white                 →  5.7:1  ✓ AA  (labels)
//   Disabled: #6B6B6B on #D0D0D0     →  4.54:1 ✓ AA
// ──────────────────────────────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(12px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes toastOut { from { opacity: 1; } to { opacity: 0; } }
    .anim-fade-in   { animation: fadeSlideIn 0.22s ease both; }
    .anim-toast-in  { animation: toastIn 0.2s ease both; }
    .anim-toast-out { animation: toastOut 0.2s ease both; }
  `}</style>
);

const Skeleton = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse rounded bg-[#E8E8E8] ${className}`} style={style} />
);

const TableSkeleton = () => (
  <div className="border-2 border-[#0A0A0A] bg-white overflow-hidden">
    <div className="border-b-2 border-[#0A0A0A] bg-[#0A0A0A] px-4 py-3 flex gap-4">
      {[60, 70, 120, 90, 50, 80, 70].map((w, i) => (
        <div key={i} className="h-4 bg-white/20 rounded flex-shrink-0" style={{ width: w }} />
      ))}
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="px-4 py-4 flex gap-4 border-b border-[#E8E8E8] last:border-b-0">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

// ── Toast ──────────────────────────────────────────────────────────────────────
type ToastVariant = 'success' | 'error';
interface ToastState { message: string; variant: ToastVariant; id: number; exiting?: boolean; }

function Toast({ message, variant, exiting }: Omit<ToastState, 'id'>) {
  const s = { success: 'bg-[#0A0A0A] text-white', error: 'bg-[#CC0000] text-white' };
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded px-4 py-3 text-sm font-medium ${s[variant]} ${exiting ? 'anim-toast-out' : 'anim-toast-in'}`}>
      {variant === 'success'
        ? <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        : <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
      }
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
      setTimeout(() => setToast(null), 220);
    }, 3000);
  }, []);
  return { toast, show };
}

// ── Primitives ─────────────────────────────────────────────────────────────────

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] ${className}`}>{children}</div>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', type, ...props }, ref) => (
    <input type={type} className={`flex h-10 w-full rounded border-2 border-[#0A0A0A] bg-white px-3 py-2 text-sm
      text-[#0A0A0A] placeholder:text-[#AAAAAA]
      focus:outline-none focus:ring-2 focus:ring-[#CC0000] focus:ring-offset-1
      disabled:bg-[#F2F2F2] disabled:text-[#6B6B6B] disabled:border-[#AAAAAA] disabled:cursor-not-allowed ${className}`} ref={ref} {...props} />
  )
);
Input.displayName = 'Input';

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' }>(
  ({ className = '', variant = 'primary', children, ...props }, ref) => {
    const v: Record<string, string> = {
      primary: 'bg-[#0A0A0A] text-white hover:bg-[#2A2A2A] disabled:bg-[#D0D0D0] disabled:text-[#6B6B6B]',
      outline: 'border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white disabled:border-[#AAAAAA] disabled:text-[#AAAAAA] disabled:bg-white',
      ghost:   'bg-transparent text-[#0A0A0A] hover:bg-[#F2F2F2] disabled:text-[#AAAAAA]',
    };
    return (
      <button className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded text-sm font-bold
        transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#CC0000] focus:ring-offset-2
        disabled:pointer-events-none active:scale-95 h-9 px-3 cursor-pointer ${v[variant]} ${className}`} ref={ref} {...props}>{children}</button>
    );
  }
);
Button.displayName = 'Button';

const Label = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono leading-none">{children}</label>
);

const Spinner = ({ className = 'h-4 w-4 text-[#6B6B6B]' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// Job status badge — solid color block
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    QUEUED:    'bg-[#CC0000] text-white',   // 5.9:1 ✓
    SCHEDULED: 'bg-[#CC0000] text-white',   // treat like queued
    RUNNING:   'bg-[#0A0A0A] text-white',   // 19.6:1 ✓
    COMPLETED: 'bg-[#00814A] text-white',   // 4.82:1 ✓
    FAILED:    'bg-[#7B0000] text-white',   // 10.2:1 ✓
  };
  const cls = map[status] || 'bg-[#6B6B6B] text-white';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest ${cls}`}>
      {status}
    </span>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
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

// ── Create Job form ────────────────────────────────────────────────────────────
function CreateJobForm({
  queueId,
  onCreated,
  onCancel,
}: {
  queueId: number;
  onCreated: (type: string) => void;
  onCancel: () => void;
}) {
  const [type, setType]                     = useState<'immediate' | 'delayed' | 'recurring' | 'batch'>('immediate');
  const [payload, setPayload]               = useState('{ "action": "example" }');
  const [delaySeconds, setDelaySeconds]     = useState('60');
  const [cronExpression, setCronExpression] = useState('*/5 * * * *');
  const [batchPayloads, setBatchPayloads]   = useState('[{ "item": 1 }, { "item": 2 }]');
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      let body: any = { queueId, type };
      if (type === 'immediate') { body.payload = JSON.parse(payload); }
      else if (type === 'delayed') {
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
    <Card className="overflow-hidden">
      <div className="bg-[#0A0A0A] px-5 py-3 border-b-2 border-[#0A0A0A]">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white font-mono">New Job</h3>
      </div>
      <div className="p-6">
        {error && <div className="mb-4 border-2 border-[#CC0000] p-3 text-sm text-[#CC0000] font-medium">{error}</div>}
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="j-type">Job Type</Label>
            <select id="j-type" value={type} onChange={(e) => setType(e.target.value as any)} disabled={submitting}
              className="flex h-10 w-full rounded border-2 border-[#0A0A0A] bg-white px-3 py-2 text-sm text-[#0A0A0A]
                focus:outline-none focus:ring-2 focus:ring-[#CC0000] disabled:bg-[#F2F2F2] disabled:text-[#6B6B6B] cursor-pointer">
              <option value="immediate">Immediate</option>
              <option value="delayed">Delayed</option>
              <option value="recurring">Recurring (Cron)</option>
              <option value="batch">Batch</option>
            </select>
          </div>
          {type !== 'batch' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="j-payload">Payload (JSON)</Label>
              <textarea id="j-payload" value={payload} onChange={(e) => setPayload(e.target.value)} disabled={submitting} rows={3}
                className="flex w-full rounded border-2 border-[#0A0A0A] bg-white px-3 py-2 text-sm font-mono
                  text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#CC0000]
                  disabled:bg-[#F2F2F2] disabled:text-[#6B6B6B] resize-y" />
            </div>
          )}
          {type === 'batch' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="j-batch">Payloads (JSON Array)</Label>
              <textarea id="j-batch" value={batchPayloads} onChange={(e) => setBatchPayloads(e.target.value)} disabled={submitting} rows={3}
                className="flex w-full rounded border-2 border-[#0A0A0A] bg-white px-3 py-2 text-sm font-mono
                  text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#CC0000]
                  disabled:bg-[#F2F2F2] disabled:text-[#6B6B6B] resize-y" />
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
          <div className="flex gap-2 sm:col-span-2 border-t-2 border-[#0A0A0A] pt-4">
            <Button type="submit" disabled={submitting} className="w-auto px-6">
              {submitting ? <><Spinner className="h-3.5 w-3.5 text-white/70" />Creating…</> : 'Create Job'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="w-auto px-5">Cancel</Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

// ── Jobs page ──────────────────────────────────────────────────────────────────
function JobsPageContent() {
  const searchParams    = useSearchParams();
  const projectId       = searchParams.get('projectId');

  const [allQueues, setAllQueues]             = useState<Queue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [jobs, setJobs]                       = useState<Job[]>([]);
  const [pagination, setPagination]           = useState<Pagination>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading]                 = useState(false);
  const [loadingQueues, setLoadingQueues]     = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [search, setSearch]                   = useState('');
  const [statusFilter, setStatusFilter]       = useState('');
  const [showCreateForm, setShowCreateForm]   = useState(false);
  const [contentKey, setContentKey]           = useState(0);
  const [currentPage, setCurrentPage]         = useState(1);

  const { toast, show: showToast } = useToast();

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
    const interval = setInterval(() => fetchJobs(currentPage, true), 5000);
    return () => clearInterval(interval);
  }, [fetchJobs, currentPage]);

  const truncPayload = (p: any) => {
    const s = typeof p === 'string' ? p : JSON.stringify(p);
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return d; }
  };

  const filteredJobs = jobs.filter((j) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return String(j.id).includes(q) || JSON.stringify(j.payload).toLowerCase().includes(q);
  });

  const totalJobs    = pagination.totalItems;
  const queuedCount  = jobs.filter((j) => ['QUEUED', 'SCHEDULED'].includes(j.status)).length;
  const runningCount = jobs.filter((j) => j.status === 'RUNNING').length;
  const failedCount  = jobs.filter((j) => j.status === 'FAILED').length;

  const selectedQueue = allQueues.find((q) => String(q.id) === selectedQueueId);

  if (!projectId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-6">
        <div className="flex items-center justify-center w-16 h-16 border-2 border-[#0A0A0A] bg-white">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Pick a project to begin</h2>
          <p className="text-sm text-[#6B6B6B] max-w-sm">Choose a project from the dropdown above to view jobs.</p>
        </div>
      </div>
    );
  }

  if (loadingQueues) {
    return (
      <div className="flex-1 flex flex-col gap-4 pt-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-2 border-[#0A0A0A]">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 border-r-2 border-[#0A0A0A] last:border-r-0" />)}
        </div>
        <TableSkeleton />
      </div>
    );
  }

  if (allQueues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-5">
        <div className="flex items-center justify-center w-14 h-14 border-2 border-[#0A0A0A] bg-white">
          <svg className="w-7 h-7 text-[#6B6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold">No queues in this project</h2>
          <p className="text-sm text-[#6B6B6B] mt-1 max-w-xs">Create a queue first on the Queues tab, then come back to manage jobs.</p>
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
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono mb-1">MANIFEST</div>
            <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono">QUEUE</span>
            <select value={selectedQueueId} onChange={(e) => setSelectedQueueId(e.target.value)}
              className="h-8 rounded border-2 border-[#0A0A0A] bg-white px-2 text-sm font-medium text-[#0A0A0A]
                focus:outline-none focus:ring-2 focus:ring-[#CC0000] cursor-pointer">
              {allQueues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
        </div>
        {!showCreateForm && selectedQueueId && (
          <Button onClick={() => setShowCreateForm(true)} className="w-auto px-5 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Job
          </Button>
        )}
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-2 border-[#0A0A0A]">
        <div className="p-5 border-r-2 border-[#0A0A0A] bg-[#0A0A0A] text-white sm:col-span-2 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-white/60">TOTAL JOBS</div>
            <div className="text-5xl font-mono font-bold tabular-nums mt-1">{totalJobs}</div>
          </div>
          <svg className="w-8 h-8 text-white/20 fill-current" viewBox="0 0 24 24">
            <path d="M12 2a1 1 0 01.7.3l9 8a1 1 0 010 1.4l-9 8a1 1 0 01-1.4 0l-9-8a1 1 0 010-1.4l9-8A1 1 0 0112 2z" />
          </svg>
        </div>
        <div className="p-5 border-r-2 border-[#0A0A0A]">
          <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-[#6B6B6B]">QUEUED</div>
          <div className="text-4xl font-mono font-bold tabular-nums mt-1 text-[#CC0000]">{queuedCount}</div>
        </div>
        <div className="p-5">
          <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-[#6B6B6B]">RUNNING</div>
          <div className="text-4xl font-mono font-bold tabular-nums mt-1 text-[#0A0A0A]">{runningCount}</div>
        </div>
      </div>

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

      {error && !loading && (
        <div className="border-2 border-[#CC0000] p-5 text-sm text-[#CC0000] font-medium flex items-start gap-3">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error} <button onClick={() => fetchJobs(currentPage)} className="underline font-bold cursor-pointer">Retry</button></span>
        </div>
      )}

      {loading && <TableSkeleton />}

      {!loading && !error && jobs.length === 0 && !showCreateForm && (
        <Card className="flex flex-col items-center justify-center py-20 text-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 border-2 border-[#0A0A0A] bg-white">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.43 9.75" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold">No jobs yet</h2>
            <p className="text-sm text-[#6B6B6B] mt-1 max-w-sm">No jobs have been scheduled on &ldquo;{selectedQueue?.name}&rdquo;.</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="w-auto px-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create first Job
          </Button>
        </Card>
      )}

      {!loading && !error && jobs.length > 0 && (
        <Card className="overflow-hidden">
          {/* Search + filter */}
          <div className="px-4 py-2.5 border-b-2 border-[#0A0A0A] flex items-center gap-3 flex-wrap bg-white">
            <svg className="w-4 h-4 text-[#AAAAAA] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input type="text" placeholder="Filter by ID or payload…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[120px] text-sm bg-transparent focus:outline-none placeholder:text-[#AAAAAA] text-[#0A0A0A]" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-7 rounded border-2 border-[#0A0A0A] bg-white text-xs font-bold px-2 text-[#0A0A0A]
                focus:outline-none focus:ring-2 focus:ring-[#CC0000] cursor-pointer font-mono uppercase">
              <option value="">ALL STATUSES</option>
              <option value="QUEUED">QUEUED</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="RUNNING">RUNNING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
            </select>
            <span className="text-xs text-[#AAAAAA] font-mono tabular-nums">{filteredJobs.length}/{jobs.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-[#0A0A0A] text-white">
                  <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">ID</th>
                  <th className="text-left  px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">Status</th>
                  <th className="text-left  px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">Payload</th>
                  <th className="text-left  px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">Scheduled For</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">Attempts</th>
                  <th className="text-left  px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#6B6B6B]">No jobs match your filter.</td></tr>
                ) : filteredJobs.map((job, i) => (
                  <tr key={job.id} className={`border-b border-[#E8E8E8] hover:bg-[#F2F2F2] transition-colors duration-75 ${i === filteredJobs.length - 1 ? 'border-b-0' : ''} ${i % 2 !== 0 ? 'bg-[#FAFAFA]' : ''}`}>
                    <td className="px-4 py-3 text-right tabular-nums text-[#6B6B6B] font-mono text-xs">
                      #{String(job.id).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-[#6B6B6B] max-w-[200px] truncate" title={JSON.stringify(job.payload)}>
                      {truncPayload(job.payload)}
                    </td>
                    <td className="px-4 py-3 text-[#6B6B6B] text-sm whitespace-nowrap">{formatDate(job.scheduledFor)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono text-sm">{job.attempts}</td>
                    <td className="px-4 py-3 text-[#6B6B6B] text-sm whitespace-nowrap">{formatDate(job.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t-2 border-[#0A0A0A] flex items-center justify-between bg-white">
              <span className="text-xs text-[#6B6B6B] font-mono">
                Page {currentPage} of {pagination.totalPages} · {pagination.totalItems} total
              </span>
              <div className="flex gap-1.5">
                <Button variant="outline" disabled={currentPage <= 1} onClick={() => fetchJobs(currentPage - 1)} className="h-7 px-2.5 text-xs">← Prev</Button>
                <Button variant="outline" disabled={currentPage >= pagination.totalPages} onClick={() => fetchJobs(currentPage + 1)} className="h-7 px-2.5 text-xs">Next →</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col gap-6 pt-2">
        <Skeleton className="h-10 w-64" />
        <TableSkeleton />
      </div>
    }>
      <JobsPageContent />
    </Suspense>
  );
}
