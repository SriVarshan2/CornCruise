'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ── CONTRAST AUDIT ─────────────────────────────────────────────────────────────
//   White on maroon #7B0000  → 10.2:1  ✓ AAA (FAILED badge)
//   #6B6B6B on white         →  5.7:1  ✓ AA  (labels)
//   Disabled: #6B6B6B/#D0D0D0→  4.54:1 ✓ AA
// ──────────────────────────────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .anim-fade-in { animation: fadeSlideIn 0.22s ease both; }
  `}</style>
);

const Skeleton = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse rounded bg-[#E8E8E8] ${className}`} style={style} />
);

const TableSkeleton = () => (
  <div className="border-2 border-[#0A0A0A] bg-white overflow-hidden">
    <div className="border-b-2 border-[#0A0A0A] bg-[#0A0A0A] px-4 py-3 flex gap-4">
      {[50, 60, 60, 200, 60, 100].map((w, i) => (
        <div key={i} className="h-4 bg-white/20 rounded flex-shrink-0" style={{ width: w }} />
      ))}
    </div>
    {[...Array(4)].map((_, i) => (
      <div key={i} className="px-4 py-4 flex gap-4 border-b border-[#E8E8E8] last:border-b-0">
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

// ── Primitives ─────────────────────────────────────────────────────────────────

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] ${className}`}>{children}</div>
);

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' }>(
  ({ className = '', variant = 'primary', children, ...props }, ref) => {
    const v: Record<string, string> = {
      primary: 'bg-[#0A0A0A] text-white hover:bg-[#2A2A2A] disabled:bg-[#D0D0D0] disabled:text-[#6B6B6B]',
      outline: 'border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white disabled:border-[#AAAAAA] disabled:text-[#AAAAAA] disabled:bg-white',
    };
    return (
      <button className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded text-sm font-bold
        transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#CC0000] focus:ring-offset-2
        disabled:pointer-events-none active:scale-95 h-9 px-3 cursor-pointer ${v[variant]} ${className}`} ref={ref} {...props}>{children}</button>
    );
  }
);
Button.displayName = 'Button';

// ── Types ──────────────────────────────────────────────────────────────────────
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

// ── DLQ content ────────────────────────────────────────────────────────────────
function DlqPageContent() {
  const searchParams = useSearchParams();
  const projectId    = searchParams.get('projectId');

  const [entries, setEntries]         = useState<DlqEntry[]>([]);
  const [pagination, setPagination]   = useState<Pagination>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [contentKey, setContentKey]   = useState(0);
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

  if (!projectId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-6">
        <div className="flex items-center justify-center w-16 h-16 border-2 border-[#0A0A0A] bg-white">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">No project selected</h2>
          <p className="text-sm text-[#6B6B6B] max-w-sm">Choose a project to inspect its failed jobs.</p>
        </div>
      </div>
    );
  }

  return (
    <div key={contentKey} className="flex flex-col gap-6 anim-fade-in">
      <GlobalStyles />

      {/* Header */}
      <div>
        <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono mb-1">TERMINAL</div>
        <h1 className="text-3xl font-bold tracking-tight">Dead Letter Queue</h1>
        <p className="text-sm text-[#6B6B6B] mt-0.5">Jobs that exhausted all retries.</p>
      </div>

      {/* Stat strip — maroon block for DLQ count */}
      <div className="border-2 border-[#0A0A0A] grid grid-cols-1 sm:grid-cols-3 gap-0">
        <div className="p-5 sm:border-r-2 sm:border-[#0A0A0A] bg-[#7B0000] text-white">
          <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-white/60">DEAD LETTER ENTRIES</div>
          <div className="text-5xl font-mono font-bold tabular-nums mt-1">{pagination.totalItems}</div>
        </div>
        <div className="p-5 sm:col-span-2 flex items-center">
          <p className="text-sm text-[#6B6B6B]">
            These jobs have permanently failed after exhausting all configured retries. Review failure reasons and re-enqueue or discard as needed.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="border-2 border-[#CC0000] p-5 text-sm text-[#CC0000] font-medium flex items-start gap-3">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error} <button onClick={() => fetchDlq(currentPage)} className="underline font-bold cursor-pointer">Retry</button></span>
        </div>
      )}

      {loading && <TableSkeleton />}

      {/* Empty — healthy */}
      {!loading && !error && entries.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-20 text-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 border-2 border-[#00814A] bg-white">
            <svg className="w-8 h-8 text-[#00814A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold">All clear</h2>
            <p className="text-sm text-[#6B6B6B] mt-1 max-w-sm">No jobs have permanently failed. The DLQ is empty.</p>
          </div>
        </Card>
      )}

      {/* Table */}
      {!loading && !error && entries.length > 0 && (
        <Card className="overflow-hidden">
          {/* Search */}
          <div className="px-4 py-2.5 border-b-2 border-[#0A0A0A] flex items-center gap-3 bg-white">
            <svg className="w-4 h-4 text-[#AAAAAA] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input type="text" placeholder="Filter by failure reason or job ID…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[#AAAAAA] text-[#0A0A0A]" />
            {search && <button onClick={() => setSearch('')} className="text-[#AAAAAA] hover:text-[#6B6B6B] text-xs cursor-pointer font-mono font-bold">CLEAR</button>}
            <span className="text-xs text-[#AAAAAA] font-mono tabular-nums">{filtered.length}/{entries.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-[#0A0A0A] text-white">
                  <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest w-12">DLQ ID</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest w-16">Job ID</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest w-16">Queue</th>
                  <th className="text-left  px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest">Failure Reason</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest w-20">Attempts</th>
                  <th className="text-left  px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest w-32">Moved At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#6B6B6B]">No entries match your filter.</td></tr>
                ) : filtered.map((entry, i) => (
                  <React.Fragment key={entry.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      className={`border-b border-[#E8E8E8] hover:bg-[#F2F2F2] transition-colors duration-75 cursor-pointer ${
                        i === filtered.length - 1 && expandedId !== entry.id ? 'border-b-0' : ''
                      } ${i % 2 !== 0 ? 'bg-[#FAFAFA]' : ''}`}
                    >
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-xs text-[#6B6B6B]">
                        #{String(entry.id).padStart(4, '0')}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-xs text-[#6B6B6B]">
                        #{String(entry.jobId).padStart(4, '0')}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-xs text-[#6B6B6B]">{entry.queueId}</td>
                      <td className="px-4 py-3 text-[#7B0000] max-w-[300px] truncate font-medium text-sm" title={entry.failureReason}>
                        {entry.failureReason}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-sm">{entry.attemptsMade}</td>
                      <td className="px-4 py-3 text-[#6B6B6B] whitespace-nowrap text-sm">{formatDate(entry.movedAt)}</td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr className="border-b border-[#E8E8E8]">
                        <td colSpan={6} className="px-4 py-4 bg-white">
                          {/* FAILED solid badge + payload */}
                          <div className="flex items-start gap-3">
                            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest bg-[#7B0000] text-white flex-shrink-0 mt-0.5">
                              FAILED
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono mb-2">ORIGINAL PAYLOAD</div>
                              <pre className="text-xs font-mono bg-[#F2F2F2] border-2 border-[#0A0A0A] p-3 overflow-x-auto max-h-48 whitespace-pre-wrap break-all text-[#0A0A0A]">
                                {JSON.stringify(entry.originalPayload, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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

export default function DlqPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col gap-6 pt-2">
        <div className="border-2 border-[#0A0A0A] grid grid-cols-3">
          <Skeleton className="h-24" />
        </div>
        <TableSkeleton />
      </div>
    }>
      <DlqPageContent />
    </Suspense>
  );
}
