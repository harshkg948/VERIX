import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  ExternalLink,
  Globe,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  CandidateProfile,
  GroundingSource,
  JobMatch,
  TrackedApplication,
} from '../types';

interface JobMatcherTabProps {
  profile: CandidateProfile;
  onUpdateProfile: (profile: CandidateProfile) => void;
  matches: JobMatch[];
  onUpdateMatches: (matches: JobMatch[]) => void;
  onTrackApplication: (app: TrackedApplication) => void;
  trackedCompanies: Set<string>;
  autoSearchSignal: number;
  onConsumeAutoSearch: () => void;
  onNavigateToTracker: () => void;
  onUpskillForRole: (role: string) => void;
  onAskAdvisor: (prompt: string) => void;
  onNotify: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

const VERIFIED_PORTALS = [
  'LinkedIn Jobs',
  'Wellfound',
  'Unstop',
  'Internshala',
  'Official Career Portals',
];

export const JobMatcherTab: React.FC<JobMatcherTabProps> = ({
  profile,
  onUpdateProfile,
  matches,
  onUpdateMatches,
  onTrackApplication,
  trackedCompanies,
  autoSearchSignal,
  onConsumeAutoSearch,
  onNavigateToTracker,
  onUpskillForRole,
  onAskAdvisor,
  onNotify,
}) => {
  const [skillInput, setSkillInput] = useState('');
  const [useSearchGrounding, setUseSearchGrounding] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<GroundingSource[]>([]);

  const updateField = <K extends keyof CandidateProfile>(
    key: K,
    value: CandidateProfile[K]
  ) => {
    onUpdateProfile({ ...profile, [key]: value });
  };

  const addSkill = () => {
    const clean = skillInput.trim();
    if (!clean) return;
    if (!profile.skills.includes(clean)) {
      updateField('skills', [...profile.skills, clean]);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    updateField(
      'skills',
      profile.skills.filter((s) => s !== skill)
    );
  };

  const handleFindMatches = async () => {
    if (!profile.preferredRole.trim()) {
      setError('Enter your preferred role before searching for matches.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSources([]);

    try {
      const res = await fetch('/api/jobs/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          useSearchGrounding,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to find safe job matches.');
      }

      const normalized: JobMatch[] = (data.matches || []).map(
        (m: any, idx: number) => ({
          id: `match-${Date.now()}-${idx}`,
          roleTitle: m.roleTitle || profile.preferredRole,
          companyType: m.companyType || 'Verified Employer',
          matchScore: Math.max(0, Math.min(100, Number(m.matchScore ?? 85))),
          verifiedPlatform: m.verifiedPlatform || 'LinkedIn Jobs',
          searchUrl: m.searchUrl || 'https://www.linkedin.com/jobs/',
          salaryRange: m.salaryRange || 'Competitive',
          whyMatched: m.whyMatched || '',
          safetyNote:
            m.safetyNote || 'Filtered for verified direct employer portals only.',
        })
      );

      onUpdateMatches(normalized);
      setSources(data.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch matches.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (autoSearchSignal > 0 && !isSearching) {
      onConsumeAutoSearch();
      handleFindMatches();
    }
  }, [autoSearchSignal]);

  const handleTrackMatch = (match: JobMatch) => {
    onTrackApplication({
      id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      company: match.companyType,
      role: match.roleTitle,
      platform: match.verifiedPlatform,
      appliedDate: new Date().toISOString().slice(0, 10),
      safetyStatus: 'Verified Safe',
      status: 'Applied',
      notes: `Matched via VERIX (${match.matchScore}% fit). Direct portal: ${match.searchUrl}`,
    });
    onNotify(`Added "${match.roleTitle}" to Application Tracker.`, 'success');
  };

  return (
    <div className="grid grid-cols-12 gap-6 items-start">
      {/* Left Bento Column (4 cols): Candidate Profile Card */}
      <div className="col-span-12 xl:col-span-4 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-6 space-y-5">
        <div className="border-b border-[#DCE6DF] pb-4">
          <h2 className="text-base font-semibold tracking-tight text-[#11241D]">
            Candidate Profile
          </h2>
          <p className="text-xs text-[#4A6358] mt-0.5">
            Synced with Skill Gap Planner and Career Safety Advisor.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Aarav Mehta"
              className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] placeholder:text-[#4A6358]/60 focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
              Degree / Branch
            </label>
            <input
              type="text"
              value={profile.degreeBranch}
              onChange={(e) => updateField('degreeBranch', e.target.value)}
              placeholder="e.g. B.Tech Computer Science (2027)"
              className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] placeholder:text-[#4A6358]/60 focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
              Preferred Role
            </label>
            <input
              type="text"
              value={profile.preferredRole}
              onChange={(e) => updateField('preferredRole', e.target.value)}
              placeholder="e.g. Frontend / Full-Stack Engineering Intern"
              className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] placeholder:text-[#4A6358]/60 focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
              Location / Remote Preference
            </label>
            <input
              type="text"
              value={profile.locationPref}
              onChange={(e) => updateField('locationPref', e.target.value)}
              placeholder="e.g. Remote or Bengaluru"
              className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] placeholder:text-[#4A6358]/60 focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#4A6358]">
              Current Skills
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#E6F0EA] border border-[#DCE6DF] text-xs font-medium text-[#11241D]"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-[#4A6358] hover:text-[#991B1B]"
                    aria-label={`Remove ${skill}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add skill + Enter"
                className="flex-1 rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3 py-2 text-xs text-[#11241D] placeholder:text-[#4A6358]/60 focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
              />
              <button
                type="button"
                onClick={addSkill}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA]"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#11241D] cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={useSearchGrounding}
              onChange={(e) => setUseSearchGrounding(e.target.checked)}
              className="h-4 w-4 rounded border-[#CBD8D0] text-[#1B5E43] focus:ring-[#1B5E43]/25"
            />
            <Globe className="h-3.5 w-3.5 text-[#1B5E43]" />
            Use Live Google Search Grounding
          </label>
        </div>

        {error && (
          <div className="rounded-xl bg-[#FEE2E2] border border-[#FECACA] px-3.5 py-2.5 text-xs text-[#991B1B]">
            {error}
          </div>
        )}

        <div className="pt-3 border-t border-[#DCE6DF] space-y-2.5">
          <button
            type="button"
            onClick={handleFindMatches}
            disabled={isSearching}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#1B5E43] rounded-xl hover:bg-[#144733] disabled:opacity-60 transition-colors"
          >
            <Search className="h-4 w-4" />
            {isSearching ? 'Matching Safe Portals...' : 'Find Safe Matches'}
          </button>
          <p className="text-[11px] text-[#4A6358] text-center">
            Excludes unverified third-party agencies and fee-charging consultancies.
          </p>
        </div>
      </div>

      {/* Right Bento Column (8 cols): 5 Tailored Matches + Verified Portals Overview */}
      <div className="col-span-12 xl:col-span-8 space-y-6">
        {matches.length === 0 ? (
          <div className="rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-bold tracking-tight text-[#11241D]">
                Verified Portal Matching Engine
              </h2>
              <p className="text-sm text-[#4A6358] max-w-2xl leading-relaxed">
                Click <strong className="text-[#11241D]">Find Safe Matches</strong> to generate 5 role tracks tailored to{' '}
                <strong className="text-[#11241D]">{profile.preferredRole}</strong> with direct search links strictly on scam-screened platforms.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {VERIFIED_PORTALS.map((portal) => (
                <div
                  key={portal}
                  className="rounded-xl bg-[#F4F7F4] border border-[#DCE6DF] p-4 flex items-center gap-2.5"
                >
                  <ShieldCheck className="h-4 w-4 text-[#1B5E43] shrink-0" />
                  <span className="text-xs font-semibold text-[#11241D]">{portal}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] px-6 py-4 shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)]">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-[#11241D]">
                  5 Tailored Safe Matches
                </h2>
                <p className="text-xs text-[#4A6358]">
                  Verified Portals Only · Zero Agency Fees
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E3F5EB] border border-[#B7E4C7] text-xs font-semibold text-[#135D3B]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Agency-Free Results
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {matches.map((match) => {
                const key = `${match.companyType}::${match.roleTitle}`.toLowerCase();
                const isTracked = trackedCompanies.has(key);

                return (
                  <div
                    key={match.id}
                    className="rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-[#4A6358]">
                            {match.verifiedPlatform} · {match.salaryRange}
                          </p>
                          <h3 className="mt-1 text-base font-bold tracking-tight text-[#11241D]">
                            {match.roleTitle}
                          </h3>
                          <p className="text-xs font-semibold text-[#4A6358] mt-0.5">
                            {match.companyType}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-[#E3F5EB] border border-[#B7E4C7] text-xs font-mono font-bold tabular-nums text-[#135D3B] shrink-0">
                          {match.matchScore}% fit
                        </span>
                      </div>

                      <p className="text-xs text-[#4A6358] leading-relaxed">
                        {match.whyMatched}
                      </p>

                      <div className="flex items-start gap-1.5 text-xs text-[#135D3B]">
                        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{match.safetyNote}</span>
                      </div>
                    </div>

                    <div className="pt-3.5 border-t border-[#DCE6DF] space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <a
                          href={match.searchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B5E43] hover:underline truncate"
                        >
                          Open on {match.verifiedPlatform}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>

                        {isTracked ? (
                          <button
                            type="button"
                            onClick={onNavigateToTracker}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#E3F5EB] text-[#135D3B] border border-[#B7E4C7] hover:brightness-95 transition-all whitespace-nowrap shrink-0"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Tracked · View
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTrackMatch(match)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#1B5E43] text-white hover:bg-[#144733] transition-colors whitespace-nowrap shrink-0"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Track Application
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => onUpskillForRole(match.roleTitle)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#4A6358] hover:text-[#1B5E43] transition-colors"
                        >
                          <Compass className="h-3.5 w-3.5" />
                          Build Upskill Plan
                        </button>
                        <span className="text-[#CBD8D0]">·</span>
                        <button
                          type="button"
                          onClick={() =>
                            onAskAdvisor(
                              `I'm considering applying for "${match.roleTitle}" (${match.companyType}) on ${match.verifiedPlatform}. What skills or safety checks should I prioritize for this portal?`
                            )
                          }
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#4A6358] hover:text-[#1B5E43] transition-colors"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Ask Advisor
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {sources.length > 0 && (
              <div className="rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-5 space-y-2.5">
                <p className="text-xs font-semibold text-[#11241D]">
                  Google Search Verification Sources
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1B5E43] hover:underline max-w-[280px] truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
