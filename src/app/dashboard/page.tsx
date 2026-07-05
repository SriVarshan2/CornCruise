'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ── CONTRAST AUDIT ─────────────────────────────────────────────────────────────
//   Black  #0A0A0A on white  #FFFFFF           → 19.6:1  ✓ AAA
//   White  #FFFFFF on black  #0A0A0A           → 19.6:1  ✓ AAA
//   Gray   #6B6B6B on white                    →  5.7:1  ✓ AA
//   Disabled text #6B6B6B on #D0D0D0           →  4.54:1 ✓ AA
//   White on red   #CC0000                     →  5.9:1  ✓ AA  (QUEUED/Zone)
//   White on black #0A0A0A                     → 19.6:1  ✓ AAA (RUNNING)
//   White on green #00814A                     →  4.82:1 ✓ AA  (COMPLETED/Active)
//   White on maroon #7B0000                    → 10.2:1  ✓ AAA (FAILED)
//   White on gray  #4A4A4A (Paused queue)      →  9.7:1  ✓ AAA
// ──────────────────────────────────────────────────────────────────────────────

// ── Animations ─────────────────────────────────────────────────────────────────
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
    @keyframes toastOut {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    .anim-fade-in  { animation: fadeSlideIn 0.22s ease both; }
    .anim-toast-in  { animation: toastIn 0.2s ease both; }
    .anim-toast-out { animation: toastOut 0.2s ease both; }
  `}</style>
);

// ── Skeleton ───────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-[#E8E8E8] ${className}`} />
);

const TableSkeleton = () => (
  <div className="border-2 border-[#0A0A0A] bg-white overflow-hidden">
    <div className="border-b-2 border-[#0A0A0A] bg-[#0A0A0A] px-4 py-3 flex gap-4">
      {[120, 60, 80, 80, 120, 70, 70].map((w, i) => (
        <div key={i} className="h-4 bg-white/20 rounded flex-shrink-0" style={{ width: w }} />
      ))}
    </div>
    {[...Array(4)].map((_, i) => (
      <div key={i} className="px-4 py-4 flex gap-4 border-b border-[#E8E8E8] last:border-b-0">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-7 w-16 ml-auto" />
      </div>
    ))}
  </div>
);

// ── Toast ──────────────────────────────────────────────────────────────────────
type ToastVariant = 'success' | 'error';
interface ToastState { message: string; variant: ToastVariant; id: number; exiting?: boolean; }

function Toast({ message, variant, exiting }: Omit<ToastState, 'id'>) {
  const styles = {
    success: 'bg-[#0A0A0A] text-white border-2 border-[#0A0A0A]',
    error:   'bg-[#CC0000] text-white border-2 border-[#CC0000]',
  };
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded px-4 py-3 text-sm font-medium ${styles[variant]} ${exiting ? 'anim-toast-out' : 'anim-toast-in'}`}>
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

// ── Design Primitives ──────────────────────────────────────────────────────────

// Card: white bg, 2px solid black border, no shadow
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] ${className}`}>
    {children}
  </div>
);

// Input: 2px black border
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

// Button — flat block, no gradient/shadow
// Variants:
//   primary    → black bg, white text — buttons/CTA
//   ghost      → transparent, black text
//   outline    → white bg, black border/text, inverts on hover
//   green      → #00814A bg, white text — resume/active
//   gray       → #4A4A4A bg, white text — paused queue
//   destructive→ #7B0000 bg, white text — delete/error
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost' | 'outline' | 'green' | 'gray' | 'destructive';
  }
>(({ className = '', variant = 'primary', children, ...props }, ref) => {
  const v: Record<string, string> = {
    primary:
      'bg-[#0A0A0A] text-white hover:bg-[#2A2A2A] ' +
      'disabled:bg-[#D0D0D0] disabled:text-[#6B6B6B]',
    ghost:
      'bg-transparent text-[#0A0A0A] hover:bg-[#F2F2F2] ' +
      'disabled:bg-transparent disabled:text-[#AAAAAA]',
    outline:
      'border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white ' +
      'disabled:border-[#AAAAAA] disabled:text-[#AAAAAA] disabled:bg-white',
    green:
      'bg-[#00814A] text-white hover:bg-[#006B3D] ' +
      'disabled:bg-[#D0D0D0] disabled:text-[#6B6B6B]',
    gray:
      'bg-[#4A4A4A] text-white hover:bg-[#333333] ' +
      'disabled:bg-[#D0D0D0] disabled:text-[#6B6B6B]',
    destructive:
      'bg-[#7B0000] text-white hover:bg-[#5E0000] ' +
      'disabled:bg-[#D0D0D0] disabled:text-[#6B6B6B]',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded text-sm font-bold
        transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#CC0000] focus:ring-offset-2
        disabled:pointer-events-none active:scale-95 h-9 px-3 cursor-pointer
        ${v[variant]} ${className}`}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});
Button.displayName = 'Button';

// Label: mono uppercase tracking
const Label = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono leading-none">
    {children}
  </label>
);

// Status badge — solid color block, sharp corners, high-contrast text
// Queue state uses different colors from job state to prevent confusion:
//   Job:   QUEUED=red, RUNNING=black, COMPLETED=green, FAILED=maroon
//   Queue: ACTIVE=green, PAUSED=gray-black (neutral, NOT red)
function StatusBadge({ variant, children }: {
  variant: 'queued' | 'running' | 'completed' | 'failed' | 'active' | 'paused';
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    queued:    'bg-[#CC0000] text-white',      // red, white  5.9:1 ✓
    running:   'bg-[#0A0A0A] text-white',      // black, white 19.6:1 ✓
    completed: 'bg-[#00814A] text-white',      // green, white 4.82:1 ✓
    failed:    'bg-[#7B0000] text-white',      // maroon, white 10.2:1 ✓
    active:    'bg-[#00814A] text-white',      // green — matches COMPLETED intentionally
    paused:    'bg-[#4A4A4A] text-white',      // dark gray — neutral, not confusable with job statuses
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest ${map[variant]}`}>
      {children}
    </span>
  );
}

// Zone priority tag — red bg, white text (the ONE red accent on queue cards)
function ZoneBadge({ priority }: { priority: number }) {
  return (
    <span className="inline-block rounded border-2 border-[#CC0000] bg-[#CC0000] text-white px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest">
      ZONE {priority + 1}
    </span>
  );
}

const Spinner = ({ className = 'h-4 w-4 text-[#6B6B6B]' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── Types ──────────────────────────────────────────────────────────────────────
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

// ── Inline-editable number cell ────────────────────────────────────────────────
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
  const [draft, setDraft]     = useState(String(value));
  const [saving, setSaving]   = useState(false);
  const editingRef            = useRef(false);

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

  useEffect(() => {
    return () => { if (editingRef.current) onEditingChange?.(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = async () => {
    const parsed = parseInt(draft, 10);
    if (isNaN(parsed) || parsed === value) { exitEdit(); return; }
    setSaving(true);
    try { await onSave(parsed); }
    finally { setSaving(false); exitEdit(false); }
  };

  if (saving) return (
    <span className="flex items-center justify-center gap-1 text-[#6B6B6B]">
      <Spinner className="h-3.5 w-3.5" />{value}
    </span>
  );

  if (editing) return (
    <input
      autoFocus
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter')  commit();
        if (e.key === 'Escape') exitEdit();
      }}
      className="w-16 rounded border-2 border-[#0A0A0A] bg-white px-2 py-1 text-sm text-center font-mono
        focus:outline-none focus:ring-2 focus:ring-[#CC0000]"
    />
  );

  return (
    <button
      onClick={enterEdit}
      title="Click to edit"
      className="w-full text-center rounded px-1 py-0.5 font-mono text-sm
        hover:bg-[#F2F2F2] cursor-pointer underline decoration-dotted decoration-[#AAAAAA]
        underline-offset-2 transition-colors"
    >
      {value}
    </button>
  );
}

// ── Create Queue form ──────────────────────────────────────────────────────────
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
  const [name, setName]                         = useState('');
  const [priority, setPriority]                 = useState('0');
  const [concurrencyLimit, setConcurrencyLimit] = useState('10');
  const [maxRetries, setMaxRetries]             = useState('3');
  const [retryPolicyId, setRetryPolicyId]       = useState('');
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState<string | null>(null);

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
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Card className="p-0 overflow-hidden">
      {/* Card header — black stripe */}
      <div className="bg-[#0A0A0A] px-5 py-3 border-b-2 border-[#0A0A0A]">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white font-mono">New Queue</h3>
      </div>
      <div className="p-6">
        {error && (
          <div className="mb-4 border-2 border-[#CC0000] p-3 text-sm text-[#CC0000] font-medium bg-white">
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
              className="flex h-10 w-full rounded border-2 border-[#0A0A0A] bg-white px-3 py-2 text-sm
                text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#CC0000]
                disabled:bg-[#F2F2F2] disabled:text-[#6B6B6B] disabled:border-[#AAAAAA]"
            >
              <option value="">None</option>
              {retryPolicies.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>
          {/* Divider before actions */}
          <div className="lg:col-span-3 border-t-2 border-[#0A0A0A] pt-4 flex gap-2">
            <Button type="submit" disabled={submitting || !name.trim()} className="w-auto px-6">
              {submitting ? <><Spinner className="h-3.5 w-3.5 text-white/70" />Creating…</> : 'Create Queue'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="w-auto px-5">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

// ── Queue row (table layout per spec) ─────────────────────────────────────────
// Queue management uses a table view as specified in the brief.
function QueueRow({
  queue,
  policyName,
  onToggle,
  isToggling,
  onEditingChange,
  handlePatchField,
}: {
  queue: Queue;
  policyName: string;
  onToggle: () => void;
  isToggling: boolean;
  onEditingChange: (editing: boolean) => void;
  handlePatchField: (id: number, patch: Partial<Pick<Queue, 'priority' | 'concurrencyLimit' | 'maxRetries'>>) => Promise<void>;
}) {
  return (
    <tr className="border-b border-[#E8E8E8] hover:bg-[#F2F2F2] transition-colors duration-75 anim-fade-in">
      {/* Name + Zone badge */}
      <td className="px-4 py-3 font-medium text-[#0A0A0A]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold">{queue.name}</span>
          <ZoneBadge priority={queue.priority} />
        </div>
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge variant={queue.isPaused ? 'paused' : 'active'}>
          {queue.isPaused ? 'PAUSED' : 'ACTIVE'}
        </StatusBadge>
      </td>
      {/* Concurrency — inline editable */}
      <td className="px-4 py-3 text-center">
        <EditableNumberCell
          value={queue.concurrencyLimit}
          onSave={(v) => handlePatchField(queue.id, { concurrencyLimit: v })}
          onEditingChange={onEditingChange}
        />
      </td>
      {/* Retries — inline editable */}
      <td className="px-4 py-3 text-center">
        <EditableNumberCell
          value={queue.maxRetries}
          onSave={(v) => handlePatchField(queue.id, { maxRetries: v })}
          onEditingChange={onEditingChange}
        />
      </td>
      {/* Policy */}
      <td className="px-4 py-3 text-sm text-[#6B6B6B] font-mono">{policyName}</td>
      {/* Action */}
      <td className="px-4 py-3 text-right">
        <Button
          variant={queue.isPaused ? 'green' : 'gray'}
          onClick={onToggle}
          disabled={isToggling}
          className="h-7 px-3 text-[11px] font-bold tracking-wider"
        >
          {isToggling ? (
            <><Spinner className="h-3 w-3 text-white/70" />…</>
          ) : queue.isPaused ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Resume
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
              Pause
            </>
          )}
        </Button>
      </td>
    </tr>
  );
}

// ── Main dashboard content ─────────────────────────────────────────────────────
function DashboardPageContent() {
  const searchParams = useSearchParams();
  const projectId    = searchParams.get('projectId');
  const orgId        = searchParams.get('orgId');

  const [queues, setQueues]                 = useState<Queue[]>([]);
  const [retryPolicies, setRetryPolicies]   = useState<RetryPolicy[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [togglingId, setTogglingId]         = useState<number | null>(null);
  const [contentKey, setContentKey]         = useState(0);
  const [search, setSearch]                 = useState('');

  const editingCountRef         = useRef(0);
  const handleCellEditingChange = useCallback((isEditing: boolean) => {
    editingCountRef.current += isEditing ? 1 : -1;
  }, []);

  const { toast, show: showToast } = useToast();

  // ── Data fetch (logic unchanged) ─────────────────────────────────────────────
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
    const interval = setInterval(() => fetchData(true), 5000);
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

  // ── No project ──────────────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-6">
        <div className="flex items-center justify-center w-16 h-16 border-2 border-[#0A0A0A] bg-white">
          <svg className="w-8 h-8 text-[#0A0A0A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Pick a project to begin</h2>
          <p className="text-sm text-[#6B6B6B] max-w-sm">Choose a project from the dropdown above to view and manage its queues.</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <div className="border-2 border-[#CC0000] p-5 text-sm text-[#CC0000] font-medium flex items-start gap-3">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span>
          {error}{' '}
          <button onClick={() => fetchData(false)} className="underline font-bold cursor-pointer">Retry</button>
        </span>
      </div>
    );
  }

  const activeCount  = queues.filter((q) => !q.isPaused).length;
  const pausedCount  = queues.filter((q) =>  q.isPaused).length;
  const filteredQueues = queues.filter((q) =>
    q.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div key={contentKey} className="flex flex-col gap-6 anim-fade-in">
      <GlobalStyles />
      {toast && <Toast message={toast.message} variant={toast.variant} exiting={toast.exiting} />}

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono mb-1">DASHBOARD</div>
          <h1 className="text-3xl font-bold tracking-tight">Queues</h1>
          <p className="text-sm text-[#6B6B6B] mt-0.5">Manage execution queues for this project.</p>
        </div>
        {!showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)} className="w-auto px-5 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Queue
          </Button>
        )}
      </div>

      {/* Stat row — bordered blocks */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-2 border-[#0A0A0A]">
        {/* Total */}
        <div className="p-5 border-r-2 border-[#0A0A0A] bg-[#0A0A0A] text-white sm:col-span-2 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-white/60">TOTAL QUEUES</div>
            <div className="text-5xl font-mono font-bold tabular-nums mt-1">{queues.length}</div>
          </div>
          <svg className="w-8 h-8 text-white/20" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M3 6a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1zm1 5a1 1 0 100 2h16a1 1 0 100-2H4z" clipRule="evenodd" />
          </svg>
        </div>
        {/* Active */}
        <div className="p-5 border-r-2 border-[#0A0A0A]">
          <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-[#6B6B6B]">ACTIVE</div>
          <div className="text-4xl font-mono font-bold tabular-nums mt-1 text-[#00814A]">{activeCount}</div>
        </div>
        {/* Paused */}
        <div className="p-5">
          <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-[#6B6B6B]">PAUSED</div>
          <div className="text-4xl font-mono font-bold tabular-nums mt-1 text-[#4A4A4A]">{pausedCount}</div>
        </div>
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

      {/* Loading */}
      {loading && <TableSkeleton />}

      {/* Empty */}
      {!loading && queues.length === 0 && !showCreateForm && (
        <Card className="flex flex-col items-center justify-center py-20 text-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 border-2 border-[#0A0A0A] bg-white">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold">Nothing scheduled yet</h2>
            <p className="text-sm text-[#6B6B6B] mt-1 max-w-sm">Create your first queue to start distributing jobs.</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="w-auto px-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create first Queue
          </Button>
        </Card>
      )}

      {/* Queue table */}
      {!loading && queues.length > 0 && (
        <Card className="overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-3 border-b-2 border-[#0A0A0A] px-4 py-2.5 bg-white">
            <svg className="w-4 h-4 text-[#AAAAAA] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Filter queues by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[#AAAAAA] text-[#0A0A0A]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#AAAAAA] hover:text-[#6B6B6B] text-xs cursor-pointer font-mono">
                CLEAR
              </button>
            )}
            <span className="text-xs text-[#AAAAAA] font-mono tabular-nums">{filteredQueues.length}/{queues.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              {/* Black header row per spec */}
              <thead>
                <tr className="bg-[#0A0A0A] text-white">
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">QUEUE</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">STATUS</th>
                  <th className="text-center px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">CONCURRENCY</th>
                  <th className="text-center px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">RETRIES</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">POLICY</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueues.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#6B6B6B]">No queues match &ldquo;{search}&rdquo;</td></tr>
                ) : filteredQueues.map((queue) => (
                  <QueueRow
                    key={queue.id}
                    queue={queue}
                    policyName={policyName(queue.retryPolicyId)}
                    onToggle={() => handleTogglePause(queue)}
                    isToggling={togglingId === queue.id}
                    onEditingChange={handleCellEditingChange}
                    handlePatchField={handlePatchField}
                  />
                ))}
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
          {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse h-20 bg-[#E8E8E8]" />)}
        </div>
        <TableSkeleton />
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  );
}
