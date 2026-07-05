'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';

// ── Shared primitives ─────────────────────────────────────────────────────────

const PrimaryBtn = ({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:ring-offset-2 disabled:pointer-events-none disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 disabled:shadow-none active:scale-95 bg-brand-terracotta text-white hover:bg-brand-terracotta-dark h-10 px-4 w-full shadow-md cursor-pointer ${className}`}
    {...props}
  >
    {children}
  </button>
);

const InlineInput = ({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) => (
  <input
    className={`flex h-10 w-full rounded-lg border border-brand-border/30 bg-white/50 px-3 py-2 text-sm placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:ring-offset-1 disabled:opacity-50 dark:border-brand-border-dark/40 dark:bg-brand-warmblack/50 dark:placeholder:text-zinc-500 ${className}`}
    {...props}
  />
);

// ── Nav tab definition ────────────────────────────────────────────────────────

const NAV_TABS = [
  { label: 'Queues',         href: '/dashboard',      segment: 'dashboard'  },
  { label: 'Jobs',           href: '/dashboard/jobs',  segment: 'jobs'       },
  { label: 'Dead Letter',    href: '/dashboard/dlq',   segment: 'dlq'        },
];

// ── Skeleton loader ───────────────────────────────────────────────────────────

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`} />
);

const OrgSkeletonRow = () => (
  <div className="flex items-center gap-3 px-2">
    <Skeleton className="h-8 w-28" />
    <Skeleton className="h-8 w-32" />
  </div>
);

// ── Layout ────────────────────────────────────────────────────────────────────

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const orgIdParam     = searchParams.get('orgId');
  const projectIdParam = searchParams.get('projectId');

  const [orgs, setOrgs]                       = useState<any[]>([]);
  const [projects, setProjects]               = useState<any[]>([]);
  const [loadingOrgs, setLoadingOrgs]         = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [newOrgName, setNewOrgName]           = useState('');
  const [newProjectName, setNewProjectName]   = useState('');
  const [creatingOrg, setCreatingOrg]         = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const [orgError, setOrgError]               = useState<string | null>(null);
  const [projectError, setProjectError]       = useState<string | null>(null);

  // ── Data loading (unchanged) ────────────────────────────────────────────────

  const loadOrgs = async () => {
    try {
      const res  = await fetch('/api/organizations', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch organizations');
      const data = await res.json();
      setOrgs(data);
      return data;
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoadingOrgs(false);
    }
  };

  useEffect(() => { loadOrgs(); }, []);

  useEffect(() => {
    if (loadingOrgs || orgs.length === 0) return;
    if (!orgIdParam) {
      const defaultOrgId = orgs[0].id;
      const params = new URLSearchParams(searchParams.toString());
      params.set('orgId', String(defaultOrgId));
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [orgs, orgIdParam, loadingOrgs]);

  useEffect(() => {
    if (!orgIdParam) { setProjects([]); return; }
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const res  = await fetch(`/api/projects?orgId=${orgIdParam}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch projects');
        const data = await res.json();
        setProjects(data);
        if (projectIdParam) {
          const projectExists = data.some((p: any) => String(p.id) === projectIdParam);
          if (!projectExists) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('projectId');
            router.replace(`${pathname}?${params.toString()}`);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProjects(false);
      }
    };
    loadProjects();
  }, [orgIdParam, projectIdParam]);

  // ── Handlers (unchanged) ────────────────────────────────────────────────────

  const handleOrgChange = (newOrgId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('orgId', newOrgId);
    params.delete('projectId');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleProjectChange = (newProjId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newProjId) params.set('projectId', newProjId);
    else           params.delete('projectId');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreatingOrg(true); setOrgError(null);
    try {
      const res  = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create organization');
      setNewOrgName('');
      await loadOrgs();
      const params = new URLSearchParams(searchParams.toString());
      params.set('orgId', String(data.id));
      params.delete('projectId');
      router.push(`${pathname}?${params.toString()}`);
    } catch (err: any) { setOrgError(err.message); }
    finally { setCreatingOrg(false); }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !orgIdParam) return;
    setCreatingProject(true); setProjectError(null);
    try {
      const res  = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName, orgId: parseInt(orgIdParam, 10) }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');
      setNewProjectName('');
      const projRes = await fetch(`/api/projects?orgId=${orgIdParam}`, { credentials: 'include' });
      if (projRes.ok) setProjects(await projRes.json());
      const params = new URLSearchParams(searchParams.toString());
      params.set('projectId', String(data.id));
      router.push(`${pathname}?${params.toString()}`);
    } catch (err: any) { setProjectError(err.message); }
    finally { setCreatingProject(false); }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/login');
    } catch (err) { console.error(err); }
  };

  // ── Derived display values ──────────────────────────────────────────────────
  const activeOrg     = orgs.find((o) => String(o.id) === orgIdParam);
  const activeProject = projects.find((p) => String(p.id) === projectIdParam);

  // ── Determine active tab ────────────────────────────────────────────────────
  const activeSegment = pathname.split('/').filter(Boolean).slice(1)[0] ?? '';

  // Build query string to append to tab hrefs so org/project context is preserved
  const qStr = searchParams.toString() ? `?${searchParams.toString()}` : '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] bg-noise text-[#2F2A24] dark:bg-[#17140F] dark:text-[#EAE2D5]">

      {/* ── Top nav bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-brand-border/20 bg-white/70 dark:border-brand-border-dark/30 dark:bg-[#1C1814]/70 backdrop-blur-md shadow-warm">

        {/* Row 1: brand + context switchers + logout */}
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link
              href={`/dashboard${qStr}`}
              className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50 shrink-0"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-terracotta text-white text-base shadow-sm font-serif italic select-none">⏱</span>
              <span className="font-serif italic font-medium">CronCruise</span>
            </Link>

            {/* Org + project selectors */}
            {loadingOrgs ? (
              <OrgSkeletonRow />
            ) : orgs.length > 0 && (
              <div className="flex items-center gap-3">
                {/* Org */}
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Org</label>
                  <select
                    value={orgIdParam || ''}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    className="h-8 rounded-lg border border-brand-border/30 bg-white/50 px-2.5 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-terracotta hover:border-brand-border/60 dark:border-brand-border-dark/40 dark:bg-[#1A1612]/50 cursor-pointer text-zinc-900 dark:text-zinc-100"
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                {/* Chevron separator */}
                <svg className="w-3.5 h-3.5 text-brand-border/50 dark:text-brand-border-dark/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Project */}
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Project</label>
                  <select
                    value={projectIdParam || ''}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    disabled={!orgIdParam || loadingProjects}
                    className="h-8 rounded-lg border border-brand-border/30 bg-white/50 px-2.5 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-terracotta hover:border-brand-border/60 disabled:opacity-50 dark:border-brand-border-dark/40 dark:bg-[#1A1612]/50 cursor-pointer text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:ring-offset-2 bg-brand-sand/55 hover:bg-brand-sand active:scale-95 text-brand-warmgray dark:bg-brand-warmgray/50 dark:hover:bg-brand-warmgray dark:text-brand-cream h-8 px-3 cursor-pointer shadow-sm shrink-0"
          >
            {/* Door icon */}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            Log out
          </button>
        </div>

        {/* Row 2: breadcrumb + tabs */}
        <div className="px-6 flex items-end justify-between border-t border-zinc-100 dark:border-zinc-800/60">
          {/* Tab nav */}
          <nav className="flex items-end gap-0 -mb-px" aria-label="Main navigation">
            {NAV_TABS.map((tab) => {
              const isActive = tab.segment === 'dashboard'
                ? activeSegment === '' || activeSegment === 'dashboard' ? !['jobs','dlq'].includes(activeSegment) : false
                : activeSegment === tab.segment;

              // For the root dashboard tab, active when no sub-segment
              const active = tab.segment === 'dashboard'
                ? !['jobs', 'dlq'].includes(activeSegment)
                : activeSegment === tab.segment;

              return (
                <Link
                  key={tab.href}
                  href={`${tab.href}${qStr}`}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 whitespace-nowrap ${
                    active
                      ? 'border-brand-terracotta text-brand-terracotta dark:border-brand-terracotta-light dark:text-brand-terracotta-light'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:border-zinc-600'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {/* Breadcrumb context */}
          {(activeOrg || activeProject) && (
            <div className="flex items-center gap-1 pb-2.5 text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
              {activeOrg && <span className="font-medium text-zinc-600 dark:text-zinc-300">{activeOrg.name}</span>}
              {activeOrg && activeProject && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
              {activeProject && <span className="font-medium text-zinc-600 dark:text-zinc-300">{activeProject.name}</span>}
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col p-6 max-w-7xl w-full mx-auto">
        {loadingOrgs ? (
          // Full-page skeleton while orgs load
          <div className="flex-1 flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>

        ) : orgs.length === 0 ? (
          // ── Create first org ──────────────────────────────────────────────
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6 text-center">
              {/* Illustration */}
              <div className="flex justify-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-sand/30 dark:bg-brand-warmgray/30 border border-brand-border/20 dark:border-brand-border-dark/30 shadow-warm">
                  <svg className="w-8 h-8 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-serif italic mb-2 text-zinc-900 dark:text-zinc-50 font-medium">Create your first organization</h2>
                <p className="text-sm text-zinc-500">Every scheduler needs an organization context before setting up queues.</p>
              </div>
              {orgError && (
                <div className="rounded-lg bg-status-failed-bg border border-status-failed/20 p-3 text-sm text-status-failed text-left">
                  {orgError}
                </div>
              )}
              <form onSubmit={handleCreateOrg} className="space-y-3 text-left">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Organization Name</label>
                <InlineInput
                  type="text"
                  placeholder="e.g. Acme Corporation"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                  disabled={creatingOrg}
                />
                <PrimaryBtn type="submit" disabled={creatingOrg || !newOrgName.trim()}>
                  {creatingOrg ? 'Creating…' : 'Establish Organization'}
                </PrimaryBtn>
              </form>
            </div>
          </div>

        ) : loadingProjects ? (
          // Skeleton while projects load
          <div className="flex-1 flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>

        ) : orgIdParam && projects.length === 0 ? (
          // ── Create first project ──────────────────────────────────────────
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6 text-center">
              <div className="flex justify-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-sand/30 dark:bg-brand-warmgray/30 border border-brand-border/20 dark:border-brand-border-dark/30 shadow-warm">
                  <svg className="w-8 h-8 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-serif italic mb-2 text-zinc-900 dark:text-zinc-50 font-medium">Create your first project</h2>
                <p className="text-sm text-zinc-500">Projects separate your execution queues. Create a project to start scheduling.</p>
              </div>
              {projectError && (
                <div className="rounded-lg bg-status-failed-bg border border-status-failed/20 p-3 text-sm text-status-failed text-left">
                  {projectError}
                </div>
              )}
              <form onSubmit={handleCreateProject} className="space-y-3 text-left">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Project Name</label>
                <InlineInput
                  type="text"
                  placeholder="e.g. Production Cluster"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                  disabled={creatingProject}
                />
                <PrimaryBtn type="submit" disabled={creatingProject || !newProjectName.trim()}>
                  {creatingProject ? 'Creating…' : 'Initiate Project'}
                </PrimaryBtn>
              </form>
            </div>
          </div>

        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] bg-noise dark:bg-[#17140F] text-zinc-500 text-sm">
        Loading…
      </div>
    }>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
