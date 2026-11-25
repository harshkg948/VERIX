import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  Compass,
  FileSpreadsheet,
  MessageSquare,
  Plus,
  ScanSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  ApplicationStatus,
  SafetyStatus,
  TrackedApplication,
  WorkspaceConfirmAction,
} from '../types';
import { exportTrackerToSheet, scheduleInterviewEvent } from '../lib/workspaceApi';

const STATUS_OPTIONS: ApplicationStatus[] = [
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Rejected',
  'Blocked Scam',
];

const SAFETY_OPTIONS: SafetyStatus[] = [
  'Verified Safe',
  'Suspicious',
  'Blocked Scam',
  'Pending Check',
];

interface TrackerTabProps {
  applications: TrackedApplication[];
  onUpdateStatus: (id: string, status: ApplicationStatus) => void;
  onAddApplication: (app: TrackedApplication) => void;
  onDeleteApplication: (id: string) => void;
  onMarkInterviewScheduled: (id: string, dateStr: string) => void;
  onScanOfferInXRay: (text: string) => void;
  onUpskillForRole: (role: string) => void;
  onAskAdvisor: (prompt: string) => void;
  workspaceToken: string | null;
  onRequestGoogleSignIn: () => Promise<string | null>;
  onRequestConfirm: (action: WorkspaceConfirmAction) => void;
  onNotify: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export const TrackerTab: React.FC<TrackerTabProps> = ({
  applications,
  onUpdateStatus,
  onAddApplication,
  onDeleteApplication,
  onMarkInterviewScheduled,
  onScanOfferInXRay,
  onUpskillForRole,
  onAskAdvisor,
  workspaceToken,
  onRequestGoogleSignIn,
  onRequestConfirm,
  onNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ApplicationStatus>('ALL');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newPlatform, setNewPlatform] = useState('Official Career Portal');
  const [newAppliedDate, setNewAppliedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newSafety, setNewSafety] = useState<SafetyStatus>('Verified Safe');
  const [newStatus, setNewStatus] = useState<ApplicationStatus>('Applied');
  const [newNotes, setNewNotes] = useState('');

  const [calendarTarget, setCalendarTarget] = useState<TrackedApplication | null>(null);
  const [calDate, setCalDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [calTime, setCalTime] = useState('11:00');
  const [calDuration, setCalDuration] = useState(45);

  const stats = useMemo(() => {
    const totalApplied = applications.filter((a) => a.status !== 'Blocked Scam').length;
    const interviews = applications.filter((a) => a.status === 'Interview').length;
    const verifiedSafe = applications.filter((a) => a.safetyStatus === 'Verified Safe').length;
    const scamsAvoided = applications.filter(
      (a) => a.safetyStatus === 'Blocked Scam' || a.status === 'Blocked Scam'
    ).length;
    return { totalApplied, interviews, verifiedSafe, scamsAvoided };
  }, [applications]);

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        app.company.toLowerCase().includes(q) ||
        app.role.toLowerCase().includes(q) ||
        app.platform.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [applications, statusFilter, searchQuery]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim() || !newRole.trim()) return;
    onAddApplication({
      id: `app-${Date.now()}`,
      company: newCompany.trim(),
      role: newRole.trim(),
      platform: newPlatform.trim() || 'Direct',
      appliedDate: newAppliedDate,
      safetyStatus: newSafety,
      status: newStatus,
      notes: newNotes.trim(),
    });
    setNewCompany('');
    setNewRole('');
    setNewNotes('');
    setShowAddModal(false);
    onNotify('Added new entry to Application Tracker.', 'success');
  };

  const ensureWorkspaceToken = async (): Promise<string | null> => {
    if (workspaceToken) return workspaceToken;
    return await onRequestGoogleSignIn();
  };

  const handleExportToSheets = async () => {
    if (applications.length === 0) {
      onNotify('Add at least one application before exporting.', 'info');
      return;
    }
    const token = await ensureWorkspaceToken();
    if (!token) return;

    onRequestConfirm({
      title: 'Export Tracker to Google Sheets',
      description: `Create a new Google Sheet containing all ${applications.length} tracked applications and scam records?`,
      details: [
        `Rows to export: ${applications.length}`,
        'Columns: Company, Role, Platform Used, Applied Date, Safety Status, Stage, Notes',
      ],
      confirmLabel: 'Create Google Sheet',
      onConfirm: async () => {
        const res = await exportTrackerToSheet(token, applications);
        onNotify('Exported Application Tracker to Google Sheets.', 'success');
        window.open(res.spreadsheetUrl, '_blank', 'noopener,noreferrer');
      },
    });
  };

  const handleScheduleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calendarTarget) return;
    const target = calendarTarget;
    const token = await ensureWorkspaceToken();
    if (!token) return;

    setCalendarTarget(null);
    onRequestConfirm({
      title: 'Add Interview to Google Calendar',
      description: `Create an event on your primary Google Calendar for ${target.company}?`,
      details: [
        `Event: Interview: ${target.role} at ${target.company}`,
        `Date & Time: ${calDate} at ${calTime} (${calDuration} mins)`,
      ],
      confirmLabel: 'Create Calendar Event',
      onConfirm: async () => {
        const res = await scheduleInterviewEvent(token, {
          company: target.company,
          role: target.role,
          date: calDate,
          time: calTime,
          durationMinutes: calDuration,
          notes: target.notes,
        });
        onMarkInterviewScheduled(target.id, `${calDate} ${calTime}`);
        onNotify(`Scheduled Google Calendar interview for ${target.company}.`, 'success');
        if (res.htmlLink) {
          window.open(res.htmlLink, '_blank', 'noopener,noreferrer');
        }
      },
    });
  };

  const renderSafetyBadge = (safety: SafetyStatus) => {
    if (safety === 'Verified Safe') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#E3F5EB] border border-[#B7E4C7] text-xs font-semibold text-[#135D3B] whitespace-nowrap">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified Safe
        </span>
      );
    }
    if (safety === 'Blocked Scam') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-xs font-semibold text-[#991B1B] whitespace-nowrap">
          <ShieldAlert className="h-3.5 w-3.5" />
          Blocked Scam
        </span>
      );
    }
    if (safety === 'Suspicious') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-xs font-semibold text-[#92400E] whitespace-nowrap">
          <ShieldAlert className="h-3.5 w-3.5" />
          Suspicious
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-[#F4F7F4] border border-[#DCE6DF] text-xs font-medium text-[#4A6358] whitespace-nowrap">
        Pending Check
      </span>
    );
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Top Summary Bento Row */}
      <div className="col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-5">
          <p className="text-xs font-medium text-[#4A6358]">Total Applied</p>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#11241D]">
            {stats.totalApplied}
          </p>
        </div>
        <div className="rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-5">
          <p className="text-xs font-medium text-[#4A6358]">Interviews</p>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#1B5E43]">
            {stats.interviews}
          </p>
        </div>
        <div className="rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-5">
          <p className="text-xs font-medium text-[#4A6358]">Verified Safe</p>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#135D3B]">
            {stats.verifiedSafe}
          </p>
        </div>
        <div className="rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-5">
          <p className="text-xs font-medium text-[#4A6358]">Scams Avoided</p>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#991B1B]">
            {stats.scamsAvoided}
          </p>
        </div>
      </div>

      {/* Interactive Filterable Table Bento Card */}
      <div className="col-span-12 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#DCE6DF]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64 max-w-full">
              <Search className="h-3.5 w-3.5 text-[#4A6358] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by company, role, platform..."
                className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] pl-9 pr-3 py-2 text-xs text-[#11241D] placeholder:text-[#4A6358]/60 focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F4F7F4] border border-[#DCE6DF] rounded-xl overflow-x-auto">
              {(['ALL', ...STATUS_OPTIONS] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-[#FCFDFB] text-[#1B5E43] shadow-xs font-semibold'
                      : 'text-[#4A6358] hover:text-[#11241D]'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportToSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#1B5E43]" />
              Export to Google Sheets
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E43] rounded-xl hover:bg-[#144733] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Manual Entry
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DCE6DF] bg-[#F4F7F4] text-[11px] font-semibold text-[#4A6358] uppercase tracking-wide">
                <th className="py-3.5 px-6">Company</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Platform Used</th>
                <th className="py-3.5 px-4">Applied Date</th>
                <th className="py-3.5 px-4">Safety Status</th>
                <th className="py-3.5 px-4">Stage</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE6DF] text-sm">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-xs text-[#4A6358]">
                    No tracked applications match the current filter.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-[#F4F7F4]/70 transition-colors">
                    <td className="py-4 px-6 font-semibold text-[#11241D]">
                      <div>{app.company}</div>
                      {app.notes && (
                        <p className="text-xs font-normal text-[#4A6358] max-w-[260px] truncate mt-0.5">
                          {app.notes}
                        </p>
                      )}
                      {app.interviewScheduled && (
                        <p className="text-[11px] font-mono text-[#1B5E43] mt-0.5">
                          Calendar: {app.interviewScheduled}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4 text-[#11241D]">{app.role}</td>
                    <td className="py-4 px-4 text-xs text-[#4A6358]">{app.platform}</td>
                    <td className="py-4 px-4 text-xs font-mono tabular-nums text-[#4A6358] whitespace-nowrap">
                      {app.appliedDate}
                    </td>
                    <td className="py-4 px-4">{renderSafetyBadge(app.safetyStatus)}</td>
                    <td className="py-4 px-4">
                      <select
                        value={app.status}
                        onChange={(e) =>
                          onUpdateStatus(app.id, e.target.value as ApplicationStatus)
                        }
                        aria-label={`Status for ${app.company}`}
                        className="rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3 py-1.5 text-xs font-medium text-[#11241D] focus:border-[#1B5E43] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {(app.safetyStatus === 'Pending Check' ||
                          app.safetyStatus === 'Suspicious') && (
                          <button
                            type="button"
                            onClick={() =>
                              onScanOfferInXRay(
                                `Company: ${app.company}\nRole: ${app.role}\nPlatform/Contact: ${app.platform}\nDetails: ${app.notes || 'Please verify this opportunity.'}`
                              )
                            }
                            title="Re-scan in Scam X-Ray"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] rounded-xl hover:brightness-95 transition-all"
                          >
                            <ScanSearch className="h-3.5 w-3.5" />
                            X-Ray
                          </button>
                        )}
                        {app.safetyStatus !== 'Blocked Scam' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setCalendarTarget(app)}
                              title="Schedule Interview in Google Calendar"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors"
                            >
                              <CalendarPlus className="h-3.5 w-3.5 text-[#1B5E43]" />
                              {app.interviewScheduled ? 'Reschedule' : 'Schedule'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpskillForRole(app.role)}
                              title="Build Upskill Plan for this role"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors"
                            >
                              <Compass className="h-3.5 w-3.5 text-[#1B5E43]" />
                              Upskill
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onAskAdvisor(
                                  `Help me prepare safely for my ${app.status} stage for ${app.role} at ${app.company} (applied via ${app.platform}). What technical & legitimacy checks should I run?`
                                )
                              }
                              title="Ask Career Safety Advisor"
                              className="p-2 rounded-xl text-[#4A6358] hover:text-[#1B5E43] hover:bg-[#E6F0EA] transition-colors"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteApplication(app.id)}
                          title="Delete entry"
                          className="p-2 rounded-xl text-[#4A6358] hover:text-[#991B1B] hover:bg-[#FEE2E2] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Manual Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#11241D]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCE6DF]">
              <h3 className="text-base font-semibold tracking-tight text-[#11241D]">
                Add Application Entry
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-[#4A6358] hover:text-[#11241D] hover:bg-[#E6F0EA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Stripe"
                  className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A6358] mb-1.5">Role</label>
                <input
                  type="text"
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="e.g. Frontend Engineering Intern"
                  className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
                    Platform Used
                  </label>
                  <input
                    type="text"
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
                    Applied Date
                  </label>
                  <input
                    type="date"
                    value={newAppliedDate}
                    onChange={(e) => setNewAppliedDate(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
                    Safety Status
                  </label>
                  <select
                    value={newSafety}
                    onChange={(e) => setNewSafety(e.target.value as SafetyStatus)}
                    className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                  >
                    {SAFETY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
                    Stage
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                    className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Recruiter email, referral, or assessment link"
                  className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#DCE6DF]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#11241D] bg-[#FCFDFB] border border-[#CBD8D0] rounded-xl hover:bg-[#E6F0EA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E43] rounded-xl hover:bg-[#144733]"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Google Calendar Event Modal */}
      {calendarTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#11241D]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCE6DF]">
              <h3 className="text-base font-semibold tracking-tight text-[#11241D]">
                Schedule Interview on Google Calendar
              </h3>
              <button
                type="button"
                onClick={() => setCalendarTarget(null)}
                className="p-1.5 rounded-lg text-[#4A6358] hover:text-[#11241D] hover:bg-[#E6F0EA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleScheduleConfirm} className="p-6 space-y-4">
              <p className="text-xs text-[#4A6358]">
                <span className="font-semibold text-[#11241D]">{calendarTarget.company}</span> —{' '}
                {calendarTarget.role}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A6358] mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    value={calDate}
                    onChange={(e) => setCalDate(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3 py-2 text-xs text-[#11241D] focus:border-[#1B5E43] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A6358] mb-1.5">Time</label>
                  <input
                    type="time"
                    required
                    value={calTime}
                    onChange={(e) => setCalTime(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3 py-2 text-xs text-[#11241D] focus:border-[#1B5E43] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
                    Duration
                  </label>
                  <select
                    value={calDuration}
                    onChange={(e) => setCalDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3 py-2 text-xs text-[#11241D] focus:border-[#1B5E43] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#DCE6DF]">
                <button
                  type="button"
                  onClick={() => setCalendarTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-[#11241D] bg-[#FCFDFB] border border-[#CBD8D0] rounded-xl hover:bg-[#E6F0EA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E43] rounded-xl hover:bg-[#144733]"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
