'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ── Animations ────────────────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .anim-fade-in { animation: fadeSlideIn 0.28s ease both; }
  `}</style>
);

// ── Skeleton ──────────────────────────────────────────────────────────────────

const Skeleton = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60 ${className}`} style={style} />
);

const TableSkeleton = () => (
  <div className="rounded-2xl border border-zinc-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-950 shadow-md overflow-hidden">
    <div className="border-b-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/60 px-4 py-3 flex gap-4">
      {[50, 60, 60, 200, 60, 100].map((w, i) => <Skeleton key={i} className="h-4" style={{ width: w }} />)}
    </div>
    {[...Array(4)].map((_, i) => (
      <div key={i} className="px-4 py-3.5 flex gap-4 border-b border-zinc-100 dark:border-zinc-800/60 last:border-b-0">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

// ── Design primitives ─────────────────────────────────────────────────────────

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-brand-border/20 bg-white/80 text-zinc-950 shadow-warm dark:border-brand-border-dark/30 dark:bg-[#1C1814]/80 dark:text-zinc-50 backdrop-blur-sm ${className}`}>{children}</div>
);

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' }>(
  ({ className = '', variant = 'primary', children, ...props }, ref) => {
    const v: Record<string, string> = {
      primary: 'bg-brand-terracotta text-white hover:bg-brand-terracotta-dark active:brightness-95 shadow-md disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 disabled:shadow-none',
      outline: 'border border-brand-border/40 bg-transparent hover:bg-brand-sand/20 text-zinc-700 dark:border-brand-border-dark/30 dark:hover:bg-brand-warmgray/20 dark:text-zinc-300 disabled:opacity-50',
    };
    return (
      <button className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:ring-offset-2 disabled:pointer-events-none active:scale-95 h-9 px-3 cursor-pointer ${v[variant]} ${className}`} ref={ref} {...props}>{children}</button>
    );
  }
);
Button.displayName = 'Button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DlqEntry {
  id: number;
  jobId: number;
  queueId: number;
  originalPayload: any;
  failureReason: string;
  attemptsMade: number;
  movedAt: string;
}

interface Pagination { page: number; pageSize: number; totalItems: number; totalPages: number; }

// ── Content ───────────────────────────────────────────────────────────────────

function DlqPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [entries, setEntries] = useState<DlqEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [contentKey, setContentKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchDlq = useCallback(async (page = 1) => {
    if (!projectId) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ projectId, page: String(page), pageSize: '20' });
      const res = await fetch(`/api/dlq?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to load DLQ'); }
      const d = await res.json();
      setEntries(d.data ?? []);
      setPagination(d.pagination);
      setCurrentPage(page);
      setContentKey((k) => k + 1);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchDlq(1); setSearch(''); }, [fetchDlq]);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return d; }
  };

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return e.failureReason.toLowerCase().includes(q) || String(e.jobId).includes(q) || String(e.id).includes(q);
  });

  // ── No project ─────────────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-sand/30 dark:bg-brand-warmgray/30 border border-brand-border/20 dark:border-brand-border-dark/30 shadow-warm">
          <svg className="w-8 h-8 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
        </div>
        <div>
          <h2 className="text-3xl font-serif italic mb-2 text-zinc-900 dark:text-zinc-50 font-medium">No project selected</h2>
          <p className="text-sm text-zinc-500 max-w-sm">Choose a project context to inspect its execution failures.</p>
        </div>
      </div>
    );
  }

  return (
    <div key={contentKey} className="flex flex-col gap-6 anim-fade-in">
      <GlobalStyles />

      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif italic font-medium tracking-tight text-zinc-900 dark:text-zinc-50">Dead Letter Queue</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Jobs that exhausted all retries and were moved here.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-status-failed/20 bg-status-failed-bg text-status-failed p-4 flex items-center gap-3 shadow-warm bg-noise">
          <svg className="w-5 h-5 text-status-failed flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          <div>
            <div className="text-2xl font-serif italic font-medium tabular-nums leading-none">{pagination.totalItems}</div>
            <div className="text-xs font-semibold text-status-failed/80 mt-1">Dead Letter Entries</div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400 flex items-start gap-3">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span>{error} <button onClick={() => fetchDlq(currentPage)} className="underline font-semibold cursor-pointer">Retry</button></span>
        </div>
      )}

      {/* Loading */}
      {loading && <TableSkeleton />}

      {/* Empty – healthy */}
      {!loading && !error && entries.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-20 text-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-status-success-bg border border-status-success/20 shadow-warm">
            <svg className="w-8 h-8 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h2 className="text-2xl font-serif italic font-medium text-zinc-900 dark:text-zinc-50">Queue is pristine</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm">Every scheduled execution has successfully resolved. No jobs have been relegated to the DLQ.</p>
          </div>
        </Card>
      )}

      {/* Table */}
      {!loading && !error && entries.length > 0 && (
        <Card className="overflow-hidden">
          {/* Search */}
          <div className="px-4 py-3 border-b border-brand-border/20 dark:border-brand-border-dark/25 flex items-center gap-3">
            <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input
              type="text"
              placeholder="Filter by failure reason or job ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-zinc-400 text-zinc-900 dark:text-zinc-100"
            />
            {search && <button onClick={() => setSearch('')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs cursor-pointer">Clear</button>}
            <span className="text-xs text-zinc-400 tabular-nums">{filtered.length}/{entries.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/60">
                  <th className="text-right text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3 w-12">ID</th>
                  <th className="text-right text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3 w-16">Job ID</th>
                  <th className="text-right text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3 w-16">Queue</th>
                  <th className="text-left  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3">Failure Reason</th>
                  <th className="text-right text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3 w-20">Attempts</th>
                  <th className="text-left  text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-4 py-3 w-32">Moved At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-400">No entries match your filter.</td></tr>
                ) : filtered.map((entry, i) => (
                  <React.Fragment key={entry.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      className={`border-b border-zinc-100 dark:border-zinc-800/60 transition-colors duration-150 hover:bg-red-50/40 dark:hover:bg-red-950/10 cursor-pointer ${i === filtered.length - 1 && expandedId !== entry.id ? 'border-b-0' : ''} ${i % 2 !== 0 ? 'bg-zinc-50/50 dark:bg-zinc-900/20' : ''}`}
                    >
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-xs text-zinc-500">{entry.id}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-xs text-zinc-500">{entry.jobId}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-xs text-zinc-500">{entry.queueId}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 max-w-[300px] truncate" title={entry.failureReason}>{entry.failureReason}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{entry.attemptsMade}</td>
                      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{formatDate(entry.movedAt)}</td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr className="border-b border-zinc-100 dark:border-zinc-800/60">
                        <td colSpan={6} className="px-4 py-4 bg-zinc-50/80 dark:bg-zinc-900/40">
                          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Original Payload</div>
                          <pre className="text-xs font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                            {JSON.stringify(entry.originalPayload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
                <Button variant="outline" disabled={currentPage <= 1} onClick={() => fetchDlq(currentPage - 1)} className="h-7 px-2.5 text-xs">← Prev</Button>
                <Button variant="outline" disabled={currentPage >= pagination.totalPages} onClick={() => fetchDlq(currentPage + 1)} className="h-7 px-2.5 text-xs">Next →</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────

export default function DlqPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col gap-6 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Skeleton className="h-20" /></div>
        <TableSkeleton />
      </div>
    }>
      <DlqPageContent />
    </Suspense>
  );
}
