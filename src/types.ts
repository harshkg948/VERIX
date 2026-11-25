export type NavTab = 'xray' | 'matcher' | 'tracker' | 'upskill';

export type RiskVerdict = 'Safe' | 'Suspicious' | 'High-Risk Scam';

export interface RedFlagItem {
  category: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
}

export interface ScamScanResult {
  id: string;
  timestamp: string;
  inputSnippet: string;
  hasImage?: boolean;
  companyName: string;
  roleTitle: string;
  senderDomain: string;
  riskScore: number;
  riskVerdict: RiskVerdict;
  summary: string;
  redFlags: RedFlagItem[];
  verificationChecklist: string[];
  modelUsed: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface VerifyGroundingResult {
  summary: string;
  sources: GroundingSource[];
}

export interface CandidateProfile {
  name: string;
  degreeBranch: string;
  skills: string[];
  preferredRole: string;
  locationPref: string;
}

export interface JobMatch {
  id: string;
  roleTitle: string;
  companyType: string;
  matchScore: number;
  verifiedPlatform: string;
  searchUrl: string;
  salaryRange: string;
  whyMatched: string;
  safetyNote: string;
}

export type ApplicationStatus =
  | 'Applied'
  | 'Assessment'
  | 'Interview'
  | 'Offer'
  | 'Rejected'
  | 'Blocked Scam';

export type SafetyStatus =
  | 'Verified Safe'
  | 'Suspicious'
  | 'Blocked Scam'
  | 'Pending Check';

export interface TrackedApplication {
  id: string;
  company: string;
  role: string;
  platform: string;
  appliedDate: string;
  safetyStatus: SafetyStatus;
  status: ApplicationStatus;
  notes?: string;
  interviewScheduled?: string;
}

export interface MissingSkillItem {
  skill: string;
  priority: 'Critical' | 'High' | 'Recommended';
  reason: string;
}

export interface RoadmapWeek {
  week: number;
  theme: string;
  milestones: string[];
}

export interface MiniProjectIdea {
  title: string;
  problemStatement: string;
  techStack: string[];
  recruiterProof: string;
}

export interface UpskillBlueprint {
  targetRole: string;
  missingSkills: MissingSkillItem[];
  roadmap: RoadmapWeek[];
  miniProject: MiniProjectIdea;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources?: GroundingSource[];
  timestamp: string;
}

export interface GmailMessagePreview {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  bodyText: string;
}

export interface WorkspaceConfirmAction {
  title: string;
  description: string;
  details: string[];
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}
