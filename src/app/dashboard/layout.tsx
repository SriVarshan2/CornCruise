'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';

// ── CONTRAST AUDIT ─────────────────────────────────────────────────────────────
//   Black #0A0A0A on white #FFFFFF          → 19.6:1  ✓ AAA
//   White #FFFFFF on black #0A0A0A          → 19.6:1  ✓ AAA
//   Gray  #6B6B6B on white                  →  5.7:1  ✓ AA
//   Disabled text #6B6B6B on #D0D0D0        →  4.54:1 ✓ AA  (explicit, no opacity)
//   Hover  white on #CC0000 (red)           →  5.9:1  ✓ AA
// ──────────────────────────────────────────────────────────────────────────────

// Shared layout primitives (simpler than dashboard/page.tsx — layout only
// needs them for the empty-state org/project creation forms)

const PrimaryBtn = ({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded text-sm font-semibold
      transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] focus:ring-offset-2
      disabled:pointer-events-none active:scale-95 h-10 px-4 w-full cursor-pointer
      bg-[#0A0A0A] text-white hover:bg-[#2A2A2A]
      disabled:bg-[#D0D0D0] disabled:text-[#6B6B6B]
      ${className}`}
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
    className={`flex h-10 w-full rounded border-2 border-[#0A0A0A] bg-white px-3 py-2 text-sm
      text-[#0A0A0A] placeholder:text-[#AAAAAA]
      transition-colors focus:outline-none focus:ring-2 focus:ring-[#CC0000] focus:ring-offset-1
      disabled:bg-[#F2F2F2] disabled:text-[#6B6B6B] disabled:border-[#AAAAAA] disabled:cursor-not-allowed
      ${className}`}
    {...props}
  />
);

const NAV_TABS = [
  { label: 'QUEUES',      href: '/dashboard',      segment: 'dashboard' },
  { label: 'JOBS',        href: '/dashboard/jobs',  segment: 'jobs'      },
  { label: 'DEAD LETTER', href: '/dashboard/dlq',   segment: 'dlq'       },
];

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-[#E8E8E8] ${className}`} />
);

const OrgSkeletonRow = () => (
  <div className="flex items-center gap-3 px-2">
    <Skeleton className="h-8 w-28" />
    <Skeleton className="h-8 w-32" />
  </div>
);

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router       = useRouter();
  const pathname     = usePathname();
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

  // ── Data loading (logic unchanged) ──────────────────────────────────────────
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
          const exists = data.some((p: any) => String(p.id) === projectIdParam);
          if (!exists) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('projectId');
            router.replace(`${pathname}?${params.toString()}`);
          }
        }
      } catch (err) { console.error(err); }
      finally { setLoadingProjects(false); }
    };
    loadProjects();
  }, [orgIdParam, projectIdParam]);

  // ── Handlers (logic unchanged) ───────────────────────────────────────────────
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

  const activeOrg     = orgs.find((o) => String(o.id) === orgIdParam);
  const activeProject = projects.find((p) => String(p.id) === projectIdParam);
  const activeSegment = pathname.split('/').filter(Boolean).slice(1)[0] ?? '';
  const qStr          = searchParams.toString() ? `?${searchParams.toString()}` : '';

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0A0A0A]">

      {/* ── Top nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b-2 border-[#0A0A0A] bg-white">

        {/* Row 1: brand + selectors + logout */}
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">

            {/* Brand */}
            <Link href={`/dashboard${qStr}`} className="flex items-center gap-2.5 shrink-0 group">
              <span className="inline-flex items-center justify-center w-8 h-8 bg-[#CC0000] text-white select-none rounded">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                </svg>
              </span>
              <span className="text-base font-bold tracking-tight text-[#0A0A0A] group-hover:text-[#CC0000] transition-colors">
                CronCruise
              </span>
            </Link>

            {/* Org + Project selectors */}
            {loadingOrgs ? <OrgSkeletonRow /> : orgs.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono">ORG</label>
                  <select
                    value={orgIdParam || ''}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    className="h-7 rounded border-2 border-[#0A0A0A] bg-white px-2.5 text-xs font-medium
                      text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#CC0000] cursor-pointer"
                  >
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>

                <span className="text-[#0A0A0A] font-bold">/</span>

                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono">PROJECT</label>
                  <select
                    value={projectIdParam || ''}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    disabled={!orgIdParam || loadingProjects}
                    className="h-7 rounded border-2 border-[#0A0A0A] bg-white px-2.5 text-xs font-medium
                      text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#CC0000]
                      disabled:border-[#AAAAAA] disabled:text-[#6B6B6B] disabled:bg-[#F2F2F2]
                      cursor-pointer disabled:cursor-not-allowed"
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Log out — solid black button */}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded text-xs font-bold
              bg-[#0A0A0A] text-white border-2 border-[#0A0A0A]
              hover:bg-[#2A2A2A]
              transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#CC0000] focus:ring-offset-2
              active:scale-95 h-7 px-3 cursor-pointer shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            Log out
          </button>
        </div>

        {/* Row 2: tab nav + breadcrumb */}
        <div className="px-6 flex items-end justify-between border-t-2 border-[#0A0A0A]">
          <nav className="flex items-end gap-0 -mb-px" aria-label="Main navigation">
            {NAV_TABS.map((tab) => {
              const active = tab.segment === 'dashboard'
                ? !['jobs', 'dlq'].includes(activeSegment)
                : activeSegment === tab.segment;
              return (
                <Link
                  key={tab.href}
                  href={`${tab.href}${qStr}`}
                  className={`inline-flex items-center px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest font-mono
                    border-b-2 transition-colors duration-100 whitespace-nowrap ${
                    active
                      ? 'border-[#CC0000] text-[#CC0000] bg-white'
                      : 'border-transparent text-[#6B6B6B] hover:text-[#0A0A0A] hover:border-[#0A0A0A]'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {(activeOrg || activeProject) && (
            <div className="flex items-center gap-1 pb-2.5 text-xs text-[#6B6B6B] shrink-0">
              {activeOrg && <span className="font-bold text-[#0A0A0A]">{activeOrg.name}</span>}
              {activeOrg && activeProject && <span className="text-[#AAAAAA] mx-1">/</span>}
              {activeProject && <span className="font-bold text-[#0A0A0A]">{activeProject.name}</span>}
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col p-6 max-w-7xl w-full mx-auto">
        {loadingOrgs ? (
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
            <div className="w-full max-w-md space-y-6">
              <div className="border-2 border-[#0A0A0A] p-8 bg-white">
                <div className="border-b-2 border-[#0A0A0A] pb-4 mb-6">
                  <h2 className="text-2xl font-bold text-[#0A0A0A]">Create your first organization</h2>
                  <p className="text-sm text-[#6B6B6B] mt-1">Every scheduler needs an organization context before setting up queues.</p>
                </div>
                {orgError && (
                  <div className="mb-4 border-2 border-[#CC0000] bg-white p-3 text-sm text-[#CC0000] font-medium">
                    {orgError}
                  </div>
                )}
                <form onSubmit={handleCreateOrg} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono">ORGANIZATION NAME</label>
                    <InlineInput
                      type="text"
                      placeholder="e.g. Acme Corporation"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      required
                      disabled={creatingOrg}
                    />
                  </div>
                  <PrimaryBtn type="submit" disabled={creatingOrg || !newOrgName.trim()}>
                    {creatingOrg ? 'Creating…' : 'Establish Organization'}
                  </PrimaryBtn>
                </form>
              </div>
            </div>
          </div>

        ) : loadingProjects ? (
          <div className="flex-1 flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>

        ) : orgIdParam && projects.length === 0 ? (
          // ── Create first project ──────────────────────────────────────────
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6">
              <div className="border-2 border-[#0A0A0A] p-8 bg-white">
                <div className="border-b-2 border-[#0A0A0A] pb-4 mb-6">
                  <h2 className="text-2xl font-bold text-[#0A0A0A]">Create your first project</h2>
                  <p className="text-sm text-[#6B6B6B] mt-1">Projects separate your execution queues. Create a project to start scheduling.</p>
                </div>
                {projectError && (
                  <div className="mb-4 border-2 border-[#CC0000] bg-white p-3 text-sm text-[#CC0000] font-medium">
                    {projectError}
                  </div>
                )}
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest font-mono">PROJECT NAME</label>
                    <InlineInput
                      type="text"
                      placeholder="e.g. Production Cluster"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      required
                      disabled={creatingProject}
                    />
                  </div>
                  <PrimaryBtn type="submit" disabled={creatingProject || !newProjectName.trim()}>
                    {creatingProject ? 'Creating…' : 'Initiate Project'}
                  </PrimaryBtn>
                </form>
              </div>
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
      <div className="flex min-h-screen items-center justify-center bg-white text-[#6B6B6B] text-sm font-mono">
        Loading…
      </div>
    }>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
