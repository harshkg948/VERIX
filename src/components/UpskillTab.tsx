import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  Briefcase,
  CalendarDays,
  Check,
  CheckSquare,
  Compass,
  FileText,
  Layers,
  ListChecks,
  MessageSquare,
  Plus,
  Wrench,
} from 'lucide-react';
import {
  CandidateProfile,
  UpskillBlueprint,
  WorkspaceConfirmAction,
} from '../types';
import { exportToGoogleDoc, syncTasksToGoogleTasks } from '../lib/workspaceApi';

interface UpskillTabProps {
  profile: CandidateProfile;
  blueprint: UpskillBlueprint | null;
  onUpdateBlueprint: (blueprint: UpskillBlueprint) => void;
  targetRoleOverride: { id: number; role: string } | null;
  onConsumeTargetRoleOverride: () => void;
  onAddSkillToProfile: (skill: string) => void;
  onFindJobsForRole: (role: string) => void;
  onAskAdvisor: (prompt: string) => void;
  workspaceToken: string | null;
  onRequestGoogleSignIn: () => Promise<string | null>;
  onRequestConfirm: (action: WorkspaceConfirmAction) => void;
  onNotify: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export const UpskillTab: React.FC<UpskillTabProps> = ({
  profile,
  blueprint,
  onUpdateBlueprint,
  targetRoleOverride,
  onConsumeTargetRoleOverride,
  onAddSkillToProfile,
  onFindJobsForRole,
  onAskAdvisor,
  workspaceToken,
  onRequestGoogleSignIn,
  onRequestConfirm,
  onNotify,
}) => {
  const [targetRole, setTargetRole] = useState(
    blueprint?.targetRole || profile.preferredRole || 'Full-Stack Software Engineer'
  );
  const [deepThinking, setDeepThinking] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateForRole = async (roleName: string) => {
    const clean = roleName.trim();
    if (!clean) {
      setError('Enter a target role to generate your upskill blueprint.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/upskill/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          targetRole: clean,
          deepThinking,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate upskill blueprint.');
      }

      onUpdateBlueprint({
        targetRole: data.targetRole || clean,
        missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
        roadmap: Array.isArray(data.roadmap) ? data.roadmap : [],
        miniProject: data.miniProject || {
          title: 'Portfolio Build',
          problemStatement: '',
          techStack: [],
          recruiterProof: '',
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate blueprint.');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (targetRoleOverride && !isGenerating) {
      setTargetRole(targetRoleOverride.role);
      onConsumeTargetRoleOverride();
      generateForRole(targetRoleOverride.role);
    }
  }, [targetRoleOverride]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    await generateForRole(targetRole);
  };

  const ensureWorkspaceToken = async (): Promise<string | null> => {
    if (workspaceToken) return workspaceToken;
    return await onRequestGoogleSignIn();
  };

  const handleSyncToGoogleTasks = async () => {
    if (!blueprint) return;
    const token = await ensureWorkspaceToken();
    if (!token) return;

    const tasksList = blueprint.roadmap.flatMap((week) =>
      week.milestones.map((m) => ({
        title: `Week ${week.week} (${week.theme}): ${m}`,
        notes: `VERIX Upskill Roadmap for ${blueprint.targetRole}`,
      }))
    );

    const listTitle = `VERIX Upskill — ${blueprint.targetRole}`;
    onRequestConfirm({
      title: 'Sync 4-Week Roadmap to Google Tasks',
      description: `Create a Google Tasks list "${listTitle}" with ${tasksList.length} weekly milestones?`,
      details: [
        `Task List: ${listTitle}`,
        `Total Milestones: ${tasksList.length} across 4 weeks`,
      ],
      confirmLabel: 'Sync to Google Tasks',
      onConfirm: async () => {
        const res = await syncTasksToGoogleTasks(token, listTitle, tasksList);
        onNotify(`Synced ${res.createdCount} milestones to Google Tasks.`, 'success');
      },
    });
  };

  const handleSaveToGoogleDocs = async () => {
    if (!blueprint) return;
    const token = await ensureWorkspaceToken();
    if (!token) return;

    const docTitle = `VERIX Upskill Blueprint — ${blueprint.targetRole}`;
    const docBody = [
      `VERIX SKILL GAP & UPSKILL BLUEPRINT`,
      `Target Role: ${blueprint.targetRole}`,
      `Candidate: ${profile.name} (${profile.degreeBranch})`,
      `Current Skills: ${profile.skills.join(', ')}`,
      ``,
      `1. MISSING HIGH-DEMAND SKILLS`,
      ...blueprint.missingSkills.map(
        (s, i) => `${i + 1}. ${s.skill} [${s.priority}] — ${s.reason}`
      ),
      ``,
      `2. 4-WEEK ACTIONABLE ROADMAP`,
      ...blueprint.roadmap.flatMap((w) => [
        `Week ${w.week}: ${w.theme}`,
        ...w.milestones.map((m) => `  - ${m}`),
      ]),
      ``,
      `3. PORTFOLIO MINI-PROJECT IDEA`,
      `Title: ${blueprint.miniProject.title}`,
      `Stack: ${blueprint.miniProject.techStack.join(', ')}`,
      `Problem: ${blueprint.miniProject.problemStatement}`,
      `Recruiter Proof: ${blueprint.miniProject.recruiterProof}`,
    ].join('\n');

    onRequestConfirm({
      title: 'Save Upskill Blueprint to Google Docs',
      description: `Create a formatted Google Doc in your Drive for "${blueprint.targetRole}"?`,
      details: [
        `Document Title: ${docTitle}`,
        'Includes: Missing Skills, 4-Week Roadmap, and Portfolio Mini-Project spec',
      ],
      confirmLabel: 'Save to Google Docs',
      onConfirm: async () => {
        const res = await exportToGoogleDoc(token, docTitle, docBody);
        onNotify(`Created Google Doc: "${docTitle}"`, 'success');
        window.open(res.docUrl, '_blank', 'noopener,noreferrer');
      },
    });
  };

  const normalizedProfileSkills = new Set(profile.skills.map((s) => s.toLowerCase()));

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Top Bento Control Card */}
      <form
        onSubmit={handleGenerate}
        className="col-span-12 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A6358] pb-3.5 border-b border-[#DCE6DF]">
          <span>
            Active Profile: <strong className="text-[#11241D]">{profile.name}</strong> ·{' '}
            {profile.skills.join(', ')}
          </span>
          <label className="inline-flex items-center gap-2 font-medium text-[#11241D] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deepThinking}
              onChange={(e) => setDeepThinking(e.target.checked)}
              className="h-4 w-4 rounded border-[#CBD8D0] text-[#1B5E43] focus:ring-[#1B5E43]/25"
            />
            <BrainCircuit className="h-3.5 w-3.5 text-[#1B5E43]" />
            High Thinking Mode
          </label>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3.5">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#4A6358] mb-1.5">
              Target Role
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Backend Engineering Intern, Product Engineer, Data Analyst"
              className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-4 py-2.5 text-sm text-[#11241D] placeholder:text-[#4A6358]/60 focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isGenerating}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1B5E43] rounded-xl hover:bg-[#144733] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {isGenerating ? 'Generating Blueprint...' : 'Generate Upskill Blueprint'}
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-xs text-[#991B1B]">
            {error}
          </div>
        )}
      </form>

      {/* Blueprint Bento Grid */}
      {blueprint ? (
        <>
          <div className="col-span-12 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] px-6 py-4 shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)]">
            <div>
              <h2 className="text-base font-bold tracking-tight text-[#11241D]">
                Blueprint for {blueprint.targetRole}
              </h2>
              <p className="text-xs text-[#4A6358] mt-0.5">
                4-week skill gap closure plan and portfolio proof tailored to your profile.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onFindJobsForRole(blueprint.targetRole)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#135D3B] bg-[#E3F5EB] border border-[#B7E4C7] rounded-xl hover:brightness-95 transition-all whitespace-nowrap shrink-0"
              >
                <Briefcase className="h-3.5 w-3.5" />
                Find Safe Jobs for Role
              </button>
              <button
                type="button"
                onClick={handleSyncToGoogleTasks}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors whitespace-nowrap shrink-0"
              >
                <ListChecks className="h-3.5 w-3.5 text-[#1B5E43]" />
                Sync to Google Tasks
              </button>
              <button
                type="button"
                onClick={handleSaveToGoogleDocs}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="h-3.5 w-3.5 text-[#1B5E43]" />
                Save to Google Docs
              </button>
            </div>
          </div>

          {/* Left Bento Column (4 cols): Missing High-Demand Skills */}
          <div className="col-span-12 xl:col-span-4 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#DCE6DF]">
              <Layers className="h-4 w-4 text-[#1B5E43]" />
              <h3 className="text-sm font-semibold tracking-tight text-[#11241D]">
                Missing High-Demand Skills
              </h3>
            </div>
            <ul className="space-y-3.5">
              {blueprint.missingSkills.map((item, idx) => {
                const alreadyInProfile = normalizedProfileSkills.has(
                  item.skill.toLowerCase()
                );
                return (
                  <li
                    key={idx}
                    className="space-y-1.5 pb-3.5 border-b border-[#DCE6DF] last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#11241D]">
                        {item.skill}
                      </span>
                      <span
                        className={`text-[11px] font-mono font-semibold uppercase ${
                          item.priority === 'Critical'
                            ? 'text-[#991B1B]'
                            : item.priority === 'High'
                            ? 'text-[#92400E]'
                            : 'text-[#4A6358]'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-xs text-[#4A6358] leading-relaxed">{item.reason}</p>
                    <div>
                      <button
                        type="button"
                        disabled={alreadyInProfile}
                        onClick={() => onAddSkillToProfile(item.skill)}
                        className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
                          alreadyInProfile
                            ? 'text-[#135D3B] cursor-default'
                            : 'text-[#1B5E43] hover:underline'
                        }`}
                      >
                        {alreadyInProfile ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            In Candidate Profile
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            Mark Learned &amp; Add to Profile
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right Bento Column (8 cols): 4-Week Actionable Roadmap + Portfolio Mini-Project */}
          <div className="col-span-12 xl:col-span-8 space-y-6">
            <div className="rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#DCE6DF]">
                <CalendarDays className="h-4 w-4 text-[#1B5E43]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#11241D]">
                  4-Week Actionable Roadmap
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blueprint.roadmap.map((week) => (
                  <div
                    key={week.week}
                    className="rounded-xl bg-[#F4F7F4] border border-[#DCE6DF] p-4 space-y-2.5"
                  >
                    <div>
                      <span className="text-[11px] font-mono font-semibold uppercase text-[#1B5E43]">
                        Week {week.week}
                      </span>
                      <h4 className="text-sm font-bold tracking-tight text-[#11241D] mt-0.5">
                        {week.theme}
                      </h4>
                    </div>
                    <ul className="space-y-1.5">
                      {week.milestones.map((m, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#11241D]">
                          <CheckSquare className="h-3.5 w-3.5 text-[#1B5E43] mt-0.5 shrink-0" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-6 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE6DF]">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-[#1B5E43]" />
                  <h3 className="text-sm font-semibold tracking-tight text-[#11241D]">
                    Portfolio Mini-Project Idea
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#4A6358]">
                    {blueprint.miniProject.techStack.join(' · ')}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onAskAdvisor(
                        `Break down the architecture and first milestone for my portfolio mini-project "${blueprint.miniProject.title}" using ${blueprint.miniProject.techStack.join(', ')} for a ${blueprint.targetRole} role.`
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B5E43] hover:underline"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Discuss in Advisor
                  </button>
                </div>
              </div>

              <h4 className="text-base font-bold tracking-tight text-[#11241D]">
                {blueprint.miniProject.title}
              </h4>
              <p className="text-sm text-[#4A6358] leading-relaxed">
                {blueprint.miniProject.problemStatement}
              </p>
              <div className="rounded-xl bg-[#E3F5EB]/60 border border-[#B7E4C7] px-4 py-3 text-xs text-[#11241D]">
                <span className="font-semibold text-[#135D3B]">What it proves to recruiters: </span>
                {blueprint.miniProject.recruiterProof}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="col-span-12 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-10 text-center space-y-2">
          <Compass className="h-8 w-8 text-[#CBD8D0] mx-auto" />
          <p className="text-sm font-semibold text-[#11241D]">
            Ready to build your Upskill Blueprint
          </p>
          <p className="text-xs text-[#4A6358] max-w-md mx-auto">
            Enter a target role above and click Generate Upskill Blueprint to inspect missing skills, a 4-week roadmap, and a portfolio mini-project.
          </p>
        </div>
      )}
    </div>
  );
};
