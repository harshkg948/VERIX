import {
  CandidateProfile,
  JobMatch,
  ScamScanResult,
  TrackedApplication,
  UpskillBlueprint,
} from '../types';

const KEYS = {
  PROFILE: 'verix_profile_v1',
  APPLICATIONS: 'verix_applications_v1',
  SCAN_HISTORY: 'verix_scan_history_v1',
  JOB_MATCHES: 'verix_job_matches_v1',
  BLUEPRINT: 'verix_upskill_blueprint_v1',
};

export const DEFAULT_PROFILE: CandidateProfile = {
  name: 'Aarav Mehta',
  degreeBranch: 'B.Tech Computer Science & Engineering (2027)',
  skills: ['React', 'TypeScript', 'Node.js', 'SQL', 'Git', 'Tailwind CSS'],
  preferredRole: 'Frontend / Full-Stack Engineering Intern',
  locationPref: 'Remote or Bengaluru, India',
};

export const DEFAULT_APPLICATIONS: TrackedApplication[] = [
  {
    id: 'app-sample-1',
    company: 'Razorpay',
    role: 'Software Engineering Intern (Frontend)',
    platform: 'Official Career Portal',
    appliedDate: '2026-11-18',
    safetyStatus: 'Verified Safe',
    status: 'Interview',
    notes: 'Recruiter verified @razorpay.com domain; Technical Round 1 scheduled.',
  },
  {
    id: 'app-sample-2',
    company: 'Linear',
    role: 'Product Engineering Intern',
    platform: 'Wellfound',
    appliedDate: '2026-11-21',
    safetyStatus: 'Verified Safe',
    status: 'Assessment',
    notes: 'Take-home UI engineering assignment submitted via official portal.',
  },
  {
    id: 'app-sample-3',
    company: 'Apex Global Tech Solutions',
    role: 'Junior Data & Web Intern',
    platform: 'WhatsApp / Unverified Gmail',
    appliedDate: '2026-11-22',
    safetyStatus: 'Blocked Scam',
    status: 'Blocked Scam',
    notes: 'Flagged by VERIX X-Ray: Demanded INR 2,499 registration fee via UPI from @gmail.com.',
  },
];

export const DEFAULT_SCAN_HISTORY: ScamScanResult[] = [
  {
    id: 'scan-sample-1',
    timestamp: '2026-11-22T14:20:00Z',
    inputSnippet: 'Congratulations! You are selected for Apex Global Tech Solutions Internship. Pay Rs. 2,499 refundable laptop kit deposit within 2 hours...',
    companyName: 'Apex Global Tech Solutions',
    roleTitle: 'Junior Data & Web Intern',
    senderDomain: 'hr.apexglobalcareers@gmail.com',
    riskScore: 94,
    riskVerdict: 'High-Risk Scam',
    summary:
      'Classic advance-fee internship scam using a free consumer Gmail address and urgent UPI payment pressure without a technical interview.',
    redFlags: [
      {
        category: 'Advance / Registration Fee',
        severity: 'high',
        detail: 'Requests INR 2,499 "refundable security deposit" prior to onboarding.',
      },
      {
        category: 'Sender Domain Mismatch',
        severity: 'high',
        detail: 'Uses free @gmail.com domain instead of a verifiable corporate domain.',
      },
      {
        category: 'Urgency Pressure',
        severity: 'medium',
        detail: 'Imposes a 2-hour deadline to forfeit the offer.',
      },
    ],
    verificationChecklist: [
      'Do not pay any registration, training, or equipment deposit fee.',
      'Check LinkedIn official company page for open internship listings.',
      'Report the sender address as phishing in Gmail.',
    ],
    modelUsed: 'gemini-4-hydrogen',
  },
];

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadProfile(): CandidateProfile {
  return safeRead<CandidateProfile>(KEYS.PROFILE, DEFAULT_PROFILE);
}

export function saveProfile(profile: CandidateProfile): void {
  safeWrite(KEYS.PROFILE, profile);
}

export function loadApplications(): TrackedApplication[] {
  return safeRead<TrackedApplication[]>(KEYS.APPLICATIONS, DEFAULT_APPLICATIONS);
}

export function saveApplications(apps: TrackedApplication[]): void {
  safeWrite(KEYS.APPLICATIONS, apps);
}

export function loadScanHistory(): ScamScanResult[] {
  return safeRead<ScamScanResult[]>(KEYS.SCAN_HISTORY, DEFAULT_SCAN_HISTORY);
}

export function saveScanHistory(history: ScamScanResult[]): void {
  safeWrite(KEYS.SCAN_HISTORY, history.slice(0, 20));
}

export function loadJobMatches(): JobMatch[] {
  return safeRead<JobMatch[]>(KEYS.JOB_MATCHES, []);
}

export function saveJobMatches(matches: JobMatch[]): void {
  safeWrite(KEYS.JOB_MATCHES, matches);
}

export function loadBlueprint(): UpskillBlueprint | null {
  return safeRead<UpskillBlueprint | null>(KEYS.BLUEPRINT, null);
}

export function saveBlueprint(blueprint: UpskillBlueprint | null): void {
  safeWrite(KEYS.BLUEPRINT, blueprint);
}
