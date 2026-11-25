import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Briefcase,
  ClipboardList,
  Compass,
  Leaf,
  LogOut,
  MessageSquare,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react';
import {
  ApplicationStatus,
  CandidateProfile,
  JobMatch,
  NavTab,
  ScamScanResult,
  TrackedApplication,
  UpskillBlueprint,
  WorkspaceConfirmAction,
} from './types';
import {
  loadApplications,
  loadBlueprint,
  loadJobMatches,
  loadProfile,
  loadScanHistory,
  saveApplications,
  saveBlueprint,
  saveJobMatches,
  saveProfile,
  saveScanHistory,
} from './lib/storage';
import {
  googleSignIn,
  initAuth,
  logoutWorkspace,
} from './lib/workspaceAuth';
import { XRayTab } from './components/XRayTab';
import { JobMatcherTab } from './components/JobMatcherTab';
import { TrackerTab } from './components/TrackerTab';
import { UpskillTab } from './components/UpskillTab';
import { ChatAdvisorDrawer } from './components/ChatAdvisorDrawer';
import { WorkspaceConfirmModal } from './components/WorkspaceConfirmModal';

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  subtitle: string;
  Icon: React.ElementType;
}[] = [
  {
    id: 'xray',
    label: 'Scam Mail & Offer X-Ray',
    subtitle: 'Forensic email, WhatsApp, and offer-letter risk screening',
    Icon: ScanSearch,
  },
  {
    id: 'matcher',
    label: 'Safe Job & Portal Matcher',
    subtitle: 'Verified platform opportunities matched to your skills',
    Icon: Briefcase,
  },
  {
    id: 'tracker',
    label: 'Application Tracker',
    subtitle: 'Track verified pipelines, interviews, and blocked scams',
    Icon: ClipboardList,
  },
  {
    id: 'upskill',
    label: 'Skill Gap & Upskill Planner',
    subtitle: 'High-demand skill gaps, 4-week milestones, and proof projects',
    Icon: Compass,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('xray');

  // Persisted domain state
  const [profile, setProfile] = useState<CandidateProfile>(() => loadProfile());
  const [applications, setApplications] = useState<TrackedApplication[]>(() =>
    loadApplications()
  );
  const [scanHistory, setScanHistory] = useState<ScamScanResult[]>(() =>
    loadScanHistory()
  );
  const [jobMatches, setJobMatches] = useState<JobMatch[]>(() => loadJobMatches());
  const [blueprint, setBlueprint] = useState<UpskillBlueprint | null>(() =>
    loadBlueprint()
  );

  // Cross-tab routing payloads
  const [xrayPrefill, setXrayPrefill] = useState<{ id: number; text: string } | null>(
    null
  );
  const [matcherAutoSearchSignal, setMatcherAutoSearchSignal] = useState(0);
  const [upskillRoleOverride, setUpskillRoleOverride] = useState<{
    id: number;
    role: string;
  } | null>(null);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<{
    id: number;
    text: string;
  } | null>(null);

  // Google Workspace Auth state (token strictly cached in memory)
  const [workspaceUser, setWorkspaceUser] = useState<User | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Advisor drawer & confirmation modal
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<WorkspaceConfirmAction | null>(
    null
  );
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);

  // Lightweight toast notification
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    tone: 'success' | 'error' | 'info';
  } | null>(null);

  const notify = useCallback(
    (message: string, tone: 'success' | 'error' | 'info' = 'info') => {
      const id = Date.now();
      setToast({ id, message, tone });
      setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 4500);
    },
    []
  );

  const syncProfileFromGoogleUser = useCallback((user: User) => {
    const googleName =
      user.displayName?.trim() ||
      user.email?.split('@')[0] ||
      '';
    if (!googleName) return;
    setProfile((prev) => {
      if (!prev.name || prev.name === 'Aarav Mehta') {
        const updated = { ...prev, name: googleName };
        saveProfile(updated);
        return updated;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    const unsub = initAuth((user, token) => {
      setWorkspaceUser(user);
      setWorkspaceToken(token);
      if (user) {
        syncProfileFromGoogleUser(user);
      }
    });
    return () => unsub();
  }, [syncProfileFromGoogleUser]);

  const handleGoogleSignIn = async (): Promise<string | null> => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setWorkspaceUser(res.user);
        setWorkspaceToken(res.accessToken);
        syncProfileFromGoogleUser(res.user);
        notify(
          `Signed in as ${res.user.displayName || res.user.email}`,
          'success'
        );
        return res.accessToken;
      }
      return null;
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or blocked.',
        'error'
      );
      return null;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await logoutWorkspace();
    setWorkspaceUser(null);
    setWorkspaceToken(null);
    notify('Signed out of Google account.', 'info');
  };

  // Persistence handlers
  const handleUpdateProfile = (next: CandidateProfile) => {
    setProfile(next);
    saveProfile(next);
  };

  const handleAddSkillToProfile = (skill: string) => {
    const clean = skill.trim();
    if (!clean) return;
    if (profile.skills.some((s) => s.toLowerCase() === clean.toLowerCase())) return;
    const next = { ...profile, skills: [...profile.skills, clean] };
    handleUpdateProfile(next);
    notify(`Added "${clean}" to your Candidate Profile.`, 'success');
  };

  const handleAddScan = (scan: ScamScanResult) => {
    const next = [scan, ...scanHistory].slice(0, 20);
    setScanHistory(next);
    saveScanHistory(next);
  };

  const handleAddApplication = (app: TrackedApplication) => {
    const next = [app, ...applications];
    setApplications(next);
    saveApplications(next);
  };

  const handleUpdateStatus = (id: string, status: ApplicationStatus) => {
    const next = applications.map((a) => (a.id === id ? { ...a, status } : a));
    setApplications(next);
    saveApplications(next);
  };

  const handleDeleteApplication = (id: string) => {
    const next = applications.filter((a) => a.id !== id);
    setApplications(next);
    saveApplications(next);
    notify('Removed entry from Application Tracker.', 'info');
  };

  const handleMarkInterviewScheduled = (id: string, dateStr: string) => {
    const next = applications.map((a) =>
      a.id === id
        ? { ...a, status: 'Interview' as ApplicationStatus, interviewScheduled: dateStr }
        : a
    );
    setApplications(next);
    saveApplications(next);
  };

  const handleUpdateMatches = (next: JobMatch[]) => {
    setJobMatches(next);
    saveJobMatches(next);
  };

  const handleUpdateBlueprint = (next: UpskillBlueprint) => {
    setBlueprint(next);
    saveBlueprint(next);
  };

  // Cross-tab workflow navigators
  const handleFindSafeRoles = (role: string) => {
    const cleanRole = role.trim() || profile.preferredRole;
    if (cleanRole && cleanRole !== 'Unspecified Role') {
      handleUpdateProfile({ ...profile, preferredRole: cleanRole });
    }
    setActiveTab('matcher');
    setMatcherAutoSearchSignal((n) => n + 1);
  };

  const handleUpskillForRole = (role: string) => {
    const cleanRole =
      role.trim() && role !== 'Unspecified Role'
        ? role.trim()
        : profile.preferredRole;
    setUpskillRoleOverride({ id: Date.now(), role: cleanRole });
    setActiveTab('upskill');
  };

  const handleScanOfferInXRay = (text: string) => {
    setXrayPrefill({ id: Date.now(), text });
    setActiveTab('xray');
  };

  const handleAskAdvisor = (prompt: string) => {
    setPendingChatPrompt({ id: Date.now(), text: prompt });
    setChatOpen(true);
  };

  const trackedCompaniesSet = useMemo(() => {
    return new Set(
      applications.map((a) => `${a.company}::${a.role}`.toLowerCase())
    );
  }, [applications]);

  const contextSummary = useMemo(() => {
    return `Candidate: ${profile.name} (${profile.degreeBranch}), Skills: ${profile.skills.join(', ')}, Preferred Role: ${profile.preferredRole}. Tracked applications: ${applications.length}. Latest scan: ${scanHistory[0]?.companyName || 'None'} (${scanHistory[0]?.riskVerdict || 'N/A'}).`;
  }, [profile, applications.length, scanHistory]);

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    setIsConfirmBusy(true);
    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } catch (err) {
      notify(
        err instanceof Error ? err.message : 'Google Workspace operation failed.',
        'error'
      );
      setConfirmAction(null);
    } finally {
      setIsConfirmBusy(false);
    }
  };

  const tabCounts: Record<NavTab, number | null> = {
    xray: scanHistory.length || null,
    matcher: jobMatches.length || null,
    tracker: applications.length || null,
    upskill: blueprint ? blueprint.missingSkills.length : null,
  };

  const activeNavMeta = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex text-[#11241D]">
      {/* Fixed 250px Deep Canopy Forest Green Sidebar */}
      <aside className="w-[250px] shrink-0 fixed inset-y-0 left-0 bg-[#132A22] text-[#F2F5F3] flex flex-col justify-between z-30 border-r border-[#1E3F33]">
        <div>
          {/* Refined Brand Emblem */}
          <div className="px-6 py-6 border-b border-[#1E3F33] flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#23473A] border border-[#86EFAC]/30 flex items-center justify-center text-[#86EFAC] shrink-0">
              <Leaf className="h-4 w-4" />
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-[#F2F5F3] block leading-none">
                VERIX
              </span>
              <span className="text-[11px] text-[#A7C4B5] tracking-wide mt-1 block">
                Career Sanctuary
              </span>
            </div>
          </div>

          {/* 4 Navigation Tabs */}
          <nav className="p-3.5 space-y-1.5" aria-label="Primary navigation">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              const count = tabCounts[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`relative w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-left text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#23473A] text-[#F2F5F3] font-semibold shadow-xs'
                      : 'text-[#C6D8CE] hover:text-[#F2F5F3] hover:bg-[#1B3A2F]'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#86EFAC]"
                    />
                  )}
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-[#86EFAC]' : 'text-[#92B5A3]'
                      }`}
                    />
                    <span className="leading-snug">{label}</span>
                  </span>
                  {count !== null && (
                    <span
                      className={`text-[11px] font-mono tabular-nums shrink-0 ${
                        isActive ? 'text-[#86EFAC]' : 'text-[#92B5A3]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Controls: AI Safety Advisor + Google Workspace Auth */}
        <div className="p-4 border-t border-[#1E3F33] space-y-3 bg-[#0F221B]">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#F2F5F3] bg-[#1E3F33] border border-[#2C5848] hover:bg-[#23473A] hover:border-[#86EFAC]/50 transition-colors whitespace-nowrap"
          >
            <MessageSquare className="h-3.5 w-3.5 text-[#86EFAC]" />
            Career Safety Advisor
          </button>

          {workspaceUser ? (
            <div className="rounded-xl border border-[#2C5848] bg-[#132A22] p-3 space-y-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {workspaceUser.photoURL ? (
                  <img
                    src={workspaceUser.photoURL}
                    alt={workspaceUser.displayName || 'Google user avatar'}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full object-cover border border-[#86EFAC]/40 shrink-0"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#23473A] border border-[#86EFAC]/40 flex items-center justify-center text-xs font-bold text-[#86EFAC] shrink-0">
                    {(workspaceUser.displayName || workspaceUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#F2F5F3] truncate">
                    {workspaceUser.displayName || workspaceUser.email?.split('@')[0] || 'Google Account'}
                  </p>
                  <p className="text-[11px] text-[#A7C4B5] truncate">
                    {workspaceUser.email}
                  </p>
                </div>
              </div>
              {!workspaceToken && (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="w-full px-3 py-1.5 text-[11px] font-semibold text-[#132A22] bg-[#86EFAC] rounded-lg hover:bg-[#6EE7B7] transition-colors"
                >
                  {isLoggingIn ? 'Connecting...' : 'Reconnect Workspace APIs'}
                </button>
              )}
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#F2F5F3] bg-[#1E3F33] border border-[#2C5848] rounded-lg hover:bg-[#23473A] transition-colors"
              >
                <LogOut className="h-3 w-3 text-[#86EFAC]" />
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoggingIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area: Full 100% Remaining Viewport Width */}
      <main className="w-full flex-1 ml-[250px] min-w-0 px-8 py-6 space-y-6">
        {/* Clean Top Context Header Bar */}
        <header className="w-full rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight text-[#11241D] whitespace-nowrap">
                  {activeNavMeta.label}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E3F5EB] border border-[#B7E4C7] text-xs font-semibold text-[#135D3B] whitespace-nowrap shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Career Shield Active
                </span>
              </div>
              <p className="text-xs text-[#4A6358] mt-0.5 truncate">
                {activeNavMeta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('matcher')}
            className="flex items-center gap-3 text-right group rounded-xl px-3.5 py-2 bg-[#F4F7F4] border border-[#DCE6DF] hover:border-[#1B5E43] transition-colors shrink-0"
          >
            <div>
              <p className="text-xs font-semibold text-[#11241D] group-hover:text-[#1B5E43] transition-colors">
                {workspaceUser?.displayName || profile.name}
              </p>
              <p className="text-[11px] text-[#4A6358] truncate max-w-[260px]">
                {workspaceUser?.email
                  ? `${workspaceUser.email} · ${profile.skills.length} skills`
                  : `${profile.preferredRole} · ${profile.skills.length} skills`}
              </p>
            </div>
            {workspaceUser?.photoURL ? (
              <img
                src={workspaceUser.photoURL}
                alt={workspaceUser.displayName || 'Profile avatar'}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full object-cover border border-[#B7E4C7] shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#E3F5EB] border border-[#B7E4C7] flex items-center justify-center text-xs font-bold text-[#135D3B] shrink-0">
                {(workspaceUser?.displayName || profile.name || 'V')[0].toUpperCase()}
              </div>
            )}
          </button>
        </header>

        {/* Active Tab Bento Workspace */}
        {activeTab === 'xray' && (
          <XRayTab
            scanHistory={scanHistory}
            onAddScan={handleAddScan}
            onSaveToTracker={handleAddApplication}
            trackedCompanies={trackedCompaniesSet}
            prefillInput={xrayPrefill}
            onConsumePrefill={() => setXrayPrefill(null)}
            onNavigateToTracker={() => setActiveTab('tracker')}
            onFindSafeAlternatives={handleFindSafeRoles}
            onUpskillForRole={handleUpskillForRole}
            onAskAdvisor={handleAskAdvisor}
            workspaceToken={workspaceToken}
            onRequestGoogleSignIn={handleGoogleSignIn}
            onRequestConfirm={setConfirmAction}
            onNotify={notify}
          />
        )}

        {activeTab === 'matcher' && (
          <JobMatcherTab
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            matches={jobMatches}
            onUpdateMatches={handleUpdateMatches}
            onTrackApplication={handleAddApplication}
            trackedCompanies={trackedCompaniesSet}
            autoSearchSignal={matcherAutoSearchSignal}
            onConsumeAutoSearch={() => setMatcherAutoSearchSignal(0)}
            onNavigateToTracker={() => setActiveTab('tracker')}
            onUpskillForRole={handleUpskillForRole}
            onAskAdvisor={handleAskAdvisor}
            onNotify={notify}
          />
        )}

        {activeTab === 'tracker' && (
          <TrackerTab
            applications={applications}
            onUpdateStatus={handleUpdateStatus}
            onAddApplication={handleAddApplication}
            onDeleteApplication={handleDeleteApplication}
            onMarkInterviewScheduled={handleMarkInterviewScheduled}
            onScanOfferInXRay={handleScanOfferInXRay}
            onUpskillForRole={handleUpskillForRole}
            onAskAdvisor={handleAskAdvisor}
            workspaceToken={workspaceToken}
            onRequestGoogleSignIn={handleGoogleSignIn}
            onRequestConfirm={setConfirmAction}
            onNotify={notify}
          />
        )}

        {activeTab === 'upskill' && (
          <UpskillTab
            profile={profile}
            blueprint={blueprint}
            onUpdateBlueprint={handleUpdateBlueprint}
            targetRoleOverride={upskillRoleOverride}
            onConsumeTargetRoleOverride={() => setUpskillRoleOverride(null)}
            onAddSkillToProfile={handleAddSkillToProfile}
            onFindJobsForRole={handleFindSafeRoles}
            onAskAdvisor={handleAskAdvisor}
            workspaceToken={workspaceToken}
            onRequestGoogleSignIn={handleGoogleSignIn}
            onRequestConfirm={setConfirmAction}
            onNotify={notify}
          />
        )}
      </main>

      {/* Multi-turn Gemini Career Safety Advisor Drawer */}
      <ChatAdvisorDrawer
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        contextSummary={contextSummary}
        pendingPrompt={pendingChatPrompt}
        onConsumePendingPrompt={() => setPendingChatPrompt(null)}
      />

      {/* Explicit Confirmation Modal for Workspace Mutations */}
      <WorkspaceConfirmModal
        action={
          confirmAction
            ? {
                ...confirmAction,
                onConfirm: executeConfirmedAction,
              }
            : null
        }
        isBusy={isConfirmBusy}
        onClose={() => {
          if (!isConfirmBusy) setConfirmAction(null);
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg ${
            toast.tone === 'error'
              ? 'bg-[#FEE2E2] border-[#FECACA] text-[#991B1B]'
              : toast.tone === 'success'
              ? 'bg-[#E3F5EB] border-[#B7E4C7] text-[#135D3B]'
              : 'bg-[#FCFDFB] border-[#DCE6DF] text-[#11241D]'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
