import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Briefcase,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileText,
  Globe,
  ImagePlus,
  ListChecks,
  Mail,
  MessageSquare,
  MessageSquareShare,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  GmailMessagePreview,
  ScamScanResult,
  TrackedApplication,
  VerifyGroundingResult,
  WorkspaceConfirmAction,
} from '../types';
import {
  exportToGoogleDoc,
  fetchJobEmails,
  listChatSpaces,
  postToChatSpace,
  syncTasksToGoogleTasks,
  WorkspaceApiError,
} from '../lib/workspaceApi';

const FAKE_INTERNSHIP_TRAP = `From: HR Talent Acquisition <hr.nexusglobal.careers@gmail.com>
Subject: URGENT: Direct Offer Letter — Software Development Intern (Stipend Rs. 45,000/month)

Dear Candidate,
Congratulations! Based on your resume profile, you have been directly selected for the Remote Software Development Internship at Nexus Global IT Solutions Pvt Ltd without further interview rounds.

Monthly Stipend: INR 45,000 + Performance Bonus
Joining Date: Immediate

MANDATORY STEP TO CONFIRM SEAT:
To process your official offer letter, company laptop kit dispatch, and portal onboarding ID, kindly pay a 100% refundable registration & security fee of Rs. 2,450 via UPI (nexus.hrverify@okicici) or click the verification link: http://bit.ly/nexus-intern-fee-portal

Note: Seats are limited. Payment must be completed within 3 hours or your selection will be automatically cancelled and reassigned. Contact HR Manager on WhatsApp only: +91-98765-43210.`;

const LEGIT_OFFER_EMAIL = `From: University Recruiting <university-recruiting@stripe.com>
Subject: Stripe Summer 2027 Software Engineering Internship — Next Steps & Official Offer

Hi Aarav,

Following your technical architecture and coding interviews with our Payments Infrastructure team on November 14 and November 19, we are pleased to extend an official offer for the Software Engineering Intern (Frontend) position in our Bengaluru office.

Offer Summary:
- Role: Software Engineering Intern (12 Weeks, May – August 2027)
- Compensation: Competitive monthly internship stipend + relocation housing allowance (details in your Greenhouse Candidate Portal)
- Background Verification: Conducted through Checkr at zero cost to candidates

Next Steps:
1. Log in to your official candidate portal at https://boards.greenhouse.io/stripe using your registered email to review and e-sign your offer letter by December 4, 2026.
2. Join our optional Intern Q&A Office Hours via Google Meet (calendar invite attached).

Note: Stripe will never ask for registration fees, equipment deposits, or personal banking credentials over email or messaging apps. Please reply directly to this @stripe.com address if you have questions.

Best regards,
Riya Sharma
University Recruiting, Stripe`;

interface XRayTabProps {
  scanHistory: ScamScanResult[];
  onAddScan: (scan: ScamScanResult) => void;
  onSaveToTracker: (app: TrackedApplication) => void;
  trackedCompanies: Set<string>;
  prefillInput: { id: number; text: string } | null;
  onConsumePrefill: () => void;
  onNavigateToTracker: () => void;
  onFindSafeAlternatives: (role: string) => void;
  onUpskillForRole: (role: string) => void;
  onAskAdvisor: (prompt: string) => void;
  workspaceToken: string | null;
  onRequestGoogleSignIn: () => Promise<string | null>;
  onRequestConfirm: (action: WorkspaceConfirmAction) => void;
  onNotify: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export const XRayTab: React.FC<XRayTabProps> = ({
  scanHistory,
  onAddScan,
  onSaveToTracker,
  trackedCompanies,
  prefillInput,
  onConsumePrefill,
  onNavigateToTracker,
  onFindSafeAlternatives,
  onUpskillForRole,
  onAskAdvisor,
  workspaceToken,
  onRequestGoogleSignIn,
  onRequestConfirm,
  onNotify,
}) => {
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<'fast' | 'deep'>('deep');
  const [imagePreview, setImagePreview] = useState<{
    dataUrl: string;
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<ScamScanResult | null>(
    scanHistory[0] || null
  );

  const [isVerifyingWeb, setIsVerifyingWeb] = useState(false);
  const [webVerification, setWebVerification] = useState<VerifyGroundingResult | null>(null);

  const [gmailOpen, setGmailOpen] = useState(false);
  const [isLoadingGmail, setIsLoadingGmail] = useState(false);
  const [gmailMessages, setGmailMessages] = useState<GmailMessagePreview[]>([]);
  const [gmailError, setGmailError] = useState<string | null>(null);

  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatSpaces, setChatSpaces] = useState<{ name: string; displayName: string }[]>([]);
  const [selectedSpace, setSelectedSpace] = useState('');
  const [chatError, setChatError] = useState<{ message: string; consoleUrl?: string } | null>(null);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [activeChatToken, setActiveChatToken] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (prefillInput) {
      setInputText(prefillInput.text);
      setAnalyzeError(null);
      onConsumePrefill();
    }
  }, [prefillInput, onConsumePrefill]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAnalyzeError('Please upload a PNG, JPG, or WebP screenshot of the offer or message.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      setImagePreview({
        dataUrl,
        base64,
        mimeType: file.type,
        name: file.name,
      });
      setAnalyzeError(null);
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = async () => {
    if (!inputText.trim() && !imagePreview) {
      setAnalyzeError('Paste an email/offer message or attach a screenshot first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);
    setWebVerification(null);

    try {
      const res = await fetch('/api/xray/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          imageBase64: imagePreview?.base64,
          imageMimeType: imagePreview?.mimeType,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed.');
      }

      const scan: ScamScanResult = {
        id: `scan-${Date.now()}`,
        timestamp: new Date().toISOString(),
        inputSnippet: inputText.trim().slice(0, 140) || `Screenshot: ${imagePreview?.name}`,
        hasImage: Boolean(imagePreview),
        companyName: data.companyName || 'Unknown Company',
        roleTitle: data.roleTitle || 'Unspecified Role',
        senderDomain: data.senderDomain || 'Unknown',
        riskScore: Math.max(0, Math.min(100, Number(data.riskScore ?? 50))),
        riskVerdict: data.riskVerdict || 'Suspicious',
        summary: data.summary || '',
        redFlags: Array.isArray(data.redFlags) ? data.redFlags : [],
        verificationChecklist: Array.isArray(data.verificationChecklist)
          ? data.verificationChecklist
          : [],
        modelUsed: data.modelUsed || 'gemini-4-hydrogen',
      };

      setCurrentResult(scan);
      onAddScan(scan);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Unable to complete scan.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleWebVerify = async () => {
    if (!currentResult) return;
    setIsVerifyingWeb(true);
    try {
      const res = await fetch('/api/verify/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: currentResult.companyName,
          senderDomain: currentResult.senderDomain,
          roleTitle: currentResult.roleTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Web verification failed.');
      setWebVerification(data);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Web verification failed.', 'error');
    } finally {
      setIsVerifyingWeb(false);
    }
  };

  const isCurrentTracked = currentResult
    ? trackedCompanies.has(
        `${currentResult.companyName}::${currentResult.roleTitle}`.toLowerCase()
      )
    : false;

  const handleSaveToTracker = () => {
    if (!currentResult || isCurrentTracked) return;
    const isScam = currentResult.riskVerdict === 'High-Risk Scam';
    const isSafe = currentResult.riskVerdict === 'Safe';

    const newApp: TrackedApplication = {
      id: `app-${Date.now()}`,
      company: currentResult.companyName,
      role: currentResult.roleTitle,
      platform:
        currentResult.senderDomain !== 'Unknown'
          ? currentResult.senderDomain
          : 'Email / Direct Message',
      appliedDate: new Date().toISOString().slice(0, 10),
      safetyStatus: isScam ? 'Blocked Scam' : isSafe ? 'Verified Safe' : 'Suspicious',
      status: isScam ? 'Blocked Scam' : 'Applied',
      notes: `VERIX Risk ${currentResult.riskScore}% (${currentResult.riskVerdict}): ${currentResult.summary}`,
    };

    onSaveToTracker(newApp);
    onNotify(
      isScam
        ? `Logged "${currentResult.companyName}" as Blocked Scam in Application Tracker.`
        : `Saved "${currentResult.companyName}" to Application Tracker.`,
      'success'
    );
  };

  const ensureWorkspaceToken = async (): Promise<string | null> => {
    if (workspaceToken) return workspaceToken;
    return await onRequestGoogleSignIn();
  };

  const handleOpenGmailImport = async () => {
    setGmailOpen(true);
    setGmailError(null);
    const token = await ensureWorkspaceToken();
    if (!token) {
      setGmailError('Sign in with Google to browse your recent job & recruiter emails.');
      return;
    }

    setIsLoadingGmail(true);
    try {
      const emails = await fetchJobEmails(token);
      setGmailMessages(emails);
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Failed to fetch Gmail messages.');
    } finally {
      setIsLoadingGmail(false);
    }
  };

  const handleExportReportToDocs = async () => {
    if (!currentResult) return;
    const token = await ensureWorkspaceToken();
    if (!token) return;

    const docTitle = `VERIX Forensic Report — ${currentResult.companyName} (${currentResult.riskVerdict})`;
    const docBody = [
      `VERIX FORENSIC AUDIT REPORT`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `Company: ${currentResult.companyName}`,
      `Role: ${currentResult.roleTitle}`,
      `Sender / Channel: ${currentResult.senderDomain}`,
      `Risk Score: ${currentResult.riskScore}% (${currentResult.riskVerdict})`,
      ``,
      `SUMMARY`,
      currentResult.summary,
      ``,
      `RED FLAGS DETECTED`,
      ...(currentResult.redFlags.length
        ? currentResult.redFlags.map(
            (f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.category}: ${f.detail}`
          )
        : ['No major red flags detected.']),
      ``,
      `VERIFICATION CHECKLIST`,
      ...currentResult.verificationChecklist.map((step, i) => `[ ] ${i + 1}. ${step}`),
    ].join('\n');

    onRequestConfirm({
      title: 'Export Forensic Report to Google Docs',
      description: `Create a new Google Doc in your Google Drive containing the forensic scan results for ${currentResult.companyName}?`,
      details: [
        `Document Title: ${docTitle}`,
        `Includes: Risk Score (${currentResult.riskScore}%), Red Flags, and Verification Checklist`,
      ],
      confirmLabel: 'Create Google Doc',
      onConfirm: async () => {
        const created = await exportToGoogleDoc(token, docTitle, docBody);
        onNotify(`Created Google Doc: "${docTitle}"`, 'success');
        window.open(created.docUrl, '_blank', 'noopener,noreferrer');
      },
    });
  };

  const handleSyncChecklistToTasks = async () => {
    if (!currentResult || currentResult.verificationChecklist.length === 0) return;
    const token = await ensureWorkspaceToken();
    if (!token) return;

    const listTitle = `Verify: ${currentResult.companyName}`;
    onRequestConfirm({
      title: 'Sync Verification Checklist to Google Tasks',
      description: `Add ${currentResult.verificationChecklist.length} verification steps to a new Google Tasks list?`,
      details: [
        `Task List: ${listTitle}`,
        ...currentResult.verificationChecklist.slice(0, 3),
      ],
      confirmLabel: 'Add to Google Tasks',
      onConfirm: async () => {
        const res = await syncTasksToGoogleTasks(
          token,
          listTitle,
          currentResult.verificationChecklist.map((step) => ({
            title: step,
            notes: `Company: ${currentResult.companyName} | Role: ${currentResult.roleTitle}`,
          }))
        );
        onNotify(`Added ${res.createdCount} verification tasks to "${res.listTitle}".`, 'success');
      },
    });
  };

  const handleOpenChatShare = async () => {
    if (!currentResult) return;
    const token = await ensureWorkspaceToken();
    if (!token) return;

    setActiveChatToken(token);
    setChatModalOpen(true);
    setChatError(null);
    setIsLoadingSpaces(true);
    try {
      const spaces = await listChatSpaces(token);
      setChatSpaces(spaces);
      if (spaces.length > 0) setSelectedSpace(spaces[0].name);
    } catch (err) {
      if (err instanceof WorkspaceApiError) {
        setChatError({ message: err.message, consoleUrl: err.consoleUrl });
      } else {
        setChatError({ message: 'Unable to load Google Chat spaces.' });
      }
    } finally {
      setIsLoadingSpaces(false);
    }
  };

  const handleConfirmChatPost = () => {
    const token = activeChatToken || workspaceToken;
    if (!currentResult || !selectedSpace || !token) return;
    const spaceLabel =
      chatSpaces.find((s) => s.name === selectedSpace)?.displayName || selectedSpace;
    const msgText = `*VERIX Career Safety Alert*\nCompany: ${currentResult.companyName} (${currentResult.roleTitle})\nVerdict: ${currentResult.riskVerdict} (${currentResult.riskScore}% Risk)\nSender: ${currentResult.senderDomain}\nSummary: ${currentResult.summary}`;

    setChatModalOpen(false);
    onRequestConfirm({
      title: 'Post Alert to Google Chat',
      description: `Send this VERIX verification summary to Google Chat space "${spaceLabel}"?`,
      details: [
        `Space: ${spaceLabel}`,
        `Verdict: ${currentResult.riskVerdict} (${currentResult.riskScore}% Risk)`,
      ],
      confirmLabel: 'Send to Google Chat',
      onConfirm: async () => {
        await postToChatSpace(token, selectedSpace, msgText);
        onNotify(`Posted alert to Google Chat space "${spaceLabel}".`, 'success');
      },
    });
  };

  const getRiskStyle = (verdict: ScamScanResult['riskVerdict']) => {
    if (verdict === 'High-Risk Scam') {
      return {
        text: 'text-[#991B1B]',
        bg: 'bg-[#FEE2E2]',
        border: 'border-[#FECACA]',
        stroke: '#991B1B',
        Icon: AlertOctagon,
      };
    }
    if (verdict === 'Suspicious') {
      return {
        text: 'text-[#92400E]',
        bg: 'bg-[#FEF3C7]',
        border: 'border-[#FDE68A]',
        stroke: '#D97706',
        Icon: ShieldAlert,
      };
    }
    return {
      text: 'text-[#135D3B]',
      bg: 'bg-[#E3F5EB]',
      border: 'border-[#B7E4C7]',
      stroke: '#1B5E43',
      Icon: ShieldCheck,
    };
  };

  const verdictStyle = currentResult ? getRiskStyle(currentResult.riskVerdict) : null;
  const VerdictIcon = verdictStyle?.Icon;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Gmail Picker Bento Card */}
      {gmailOpen && (
        <div className="col-span-12 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[#11241D]">
                Recent Job &amp; Recruiter Emails (Gmail)
              </h2>
              <p className="text-xs text-[#4A6358] mt-0.5">
                Select an email to load its headers and full message into the X-Ray scanner.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGmailOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-[#4A6358] hover:text-[#11241D] rounded-lg hover:bg-[#E6F0EA] transition-colors"
            >
              Close
            </button>
          </div>

          {isLoadingGmail && (
            <div className="py-6 text-center text-xs text-[#4A6358]">
              Reading matching messages from Gmail...
            </div>
          )}

          {gmailError && (
            <div className="rounded-xl bg-[#FEF3C7] border border-[#FDE68A] px-4 py-3 text-xs text-[#92400E]">
              {gmailError}
            </div>
          )}

          {!isLoadingGmail && !gmailError && gmailMessages.length === 0 && (
            <div className="py-6 text-center text-xs text-[#4A6358]">
              No recent emails matching offer, internship, interview, or recruiter keywords.
            </div>
          )}

          {!isLoadingGmail && gmailMessages.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gmailMessages.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => {
                    setInputText(msg.bodyText);
                    setGmailOpen(false);
                    onNotify(`Loaded email "${msg.subject}" into X-Ray.`, 'info');
                  }}
                  className="text-left rounded-xl border border-[#DCE6DF] bg-[#F4F7F4] px-4 py-3.5 hover:border-[#1B5E43] hover:bg-[#E6F0EA]/60 transition-colors flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#11241D] truncate">{msg.subject}</p>
                    <p className="text-xs text-[#4A6358] truncate mt-1">
                      {msg.from} · {msg.snippet}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#1B5E43] whitespace-nowrap shrink-0">
                    Load
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Left Bento Column: Offer / Message Input */}
      <div className="col-span-12 xl:col-span-6 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-6 space-y-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[#11241D]">
                Message or Offer Input
              </h2>
              <p className="text-xs text-[#4A6358] mt-0.5">
                Paste email headers, WhatsApp pitches, or attach an offer screenshot.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenGmailImport}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors whitespace-nowrap shrink-0"
            >
              <Mail className="h-3.5 w-3.5 text-[#1B5E43]" />
              Import from Gmail
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInputText(FAKE_INTERNSHIP_TRAP);
                setAnalyzeError(null);
              }}
              className="px-3 py-1.5 text-xs font-medium text-[#991B1B] bg-[#FEE2E2] border border-[#FECACA] rounded-xl hover:brightness-95 transition-all whitespace-nowrap shrink-0"
            >
              Load Fake Internship Trap
            </button>
            <button
              type="button"
              onClick={() => {
                setInputText(LEGIT_OFFER_EMAIL);
                setAnalyzeError(null);
              }}
              className="px-3 py-1.5 text-xs font-medium text-[#135D3B] bg-[#E3F5EB] border border-[#B7E4C7] rounded-xl hover:brightness-95 transition-all whitespace-nowrap shrink-0"
            >
              Load Legit Offer Email
            </button>
          </div>

          <textarea
            rows={12}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste the full email (including From address), WhatsApp/Telegram recruiter pitch, or offer letter terms here..."
            className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-4 py-3.5 text-sm text-[#11241D] placeholder:text-[#4A6358]/60 focus:border-[#1B5E43] focus:bg-[#FCFDFB] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25 leading-relaxed font-mono transition-colors"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors whitespace-nowrap shrink-0"
              >
                <ImagePlus className="h-3.5 w-3.5 text-[#1B5E43]" />
                Attach Offer Screenshot
              </button>
              {imagePreview && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#E6F0EA] border border-[#DCE6DF] text-xs text-[#11241D]">
                  <span className="max-w-[150px] truncate font-medium">{imagePreview.name}</span>
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="text-[#4A6358] hover:text-[#991B1B]"
                    aria-label="Remove attached image"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F4F7F4] border border-[#DCE6DF] rounded-xl">
              <button
                type="button"
                onClick={() => setMode('fast')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'fast'
                    ? 'bg-[#FCFDFB] text-[#1B5E43] shadow-xs font-semibold'
                    : 'text-[#4A6358] hover:text-[#11241D]'
                }`}
              >
                <Zap className="h-3 w-3" />
                Instant Triage
              </button>
              <button
                type="button"
                onClick={() => setMode('deep')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'deep'
                    ? 'bg-[#FCFDFB] text-[#1B5E43] shadow-xs font-semibold'
                    : 'text-[#4A6358] hover:text-[#11241D]'
                }`}
              >
                Deep Forensic
              </button>
            </div>
          </div>

          {imagePreview && (
            <div className="rounded-xl border border-[#DCE6DF] p-2.5 bg-[#F4F7F4]">
              <img
                src={imagePreview.dataUrl}
                alt="Uploaded offer or recruiter screenshot"
                className="max-h-44 rounded-lg object-contain mx-auto"
              />
            </div>
          )}

          {analyzeError && (
            <div className="rounded-xl bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-xs text-[#991B1B]">
              {analyzeError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#DCE6DF]">
          <span className="text-xs text-[#4A6358]">
            {mode === 'fast'
              ? 'Low-latency scan · gemini-3.1-flash-lite'
              : 'High thinking audit · gemini-4-hydrogen'}
          </span>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1B5E43] rounded-xl hover:bg-[#144733] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {isAnalyzing ? 'Scanning Offer...' : 'Run Scam X-Ray'}
          </button>
        </div>
      </div>

      {/* Right Bento Column: Forensic Output */}
      <div className="col-span-12 xl:col-span-6 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-6 space-y-5">
        {!currentResult ? (
          <div className="py-20 text-center space-y-2.5">
            <ShieldCheck className="h-9 w-9 text-[#CBD8D0] mx-auto" />
            <p className="text-sm font-semibold text-[#11241D]">No active scan selected</p>
            <p className="text-xs text-[#4A6358] max-w-sm mx-auto leading-relaxed">
              Paste a suspicious email or click one of the demo buttons on the left to generate a forensic risk gauge, red flags, and recruiter verification checklist.
            </p>
          </div>
        ) : (
          <>
            {/* Risk Gauge & Verdict Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#DCE6DF]">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0">
                  <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke="#E6F0EA"
                      strokeWidth="7"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke={verdictStyle?.stroke}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 32}
                      strokeDashoffset={
                        2 * Math.PI * 32 * (1 - currentResult.riskScore / 100)
                      }
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold font-mono tabular-nums text-[#11241D]">
                      {currentResult.riskScore}%
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    {VerdictIcon && verdictStyle && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold ${verdictStyle.bg} ${verdictStyle.border} ${verdictStyle.text}`}
                      >
                        <VerdictIcon className="h-3.5 w-3.5" />
                        {currentResult.riskVerdict}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-lg font-bold tracking-tight text-[#11241D]">
                    {currentResult.companyName}
                  </h3>
                  <p className="text-xs text-[#4A6358] mt-0.5">
                    {currentResult.roleTitle} ·{' '}
                    <span className="font-mono text-[#11241D]">{currentResult.senderDomain}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {isCurrentTracked ? (
                  <button
                    type="button"
                    onClick={onNavigateToTracker}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#135D3B] bg-[#E3F5EB] border border-[#B7E4C7] rounded-xl hover:brightness-95 transition-all whitespace-nowrap shrink-0"
                  >
                    <BookmarkCheck className="h-3.5 w-3.5" />
                    Saved · View in Tracker
                    <ArrowRight className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveToTracker}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E43] rounded-xl hover:bg-[#144733] transition-colors whitespace-nowrap shrink-0"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Save to Tracker
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleWebVerify}
                  disabled={isVerifyingWeb}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors whitespace-nowrap shrink-0"
                >
                  <Globe className="h-3.5 w-3.5 text-[#1B5E43]" />
                  {isVerifyingWeb ? 'Searching Web...' : 'Verify via Google Search'}
                </button>
              </div>
            </div>

            <p className="text-sm text-[#11241D] leading-relaxed">{currentResult.summary}</p>

            {/* Cross-Feature Ecosystem Actions */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#F4F7F4] border border-[#DCE6DF] p-3">
              <span className="text-xs font-medium text-[#4A6358] mr-1">Next steps:</span>
              <button
                type="button"
                onClick={() => onFindSafeAlternatives(currentResult.roleTitle)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#135D3B] bg-[#FCFDFB] border border-[#CBD8D0] rounded-lg hover:border-[#1B5E43] hover:bg-[#E3F5EB] transition-colors"
              >
                <Briefcase className="h-3.5 w-3.5" />
                {currentResult.riskVerdict === 'Safe'
                  ? 'Compare Similar Safe Roles'
                  : 'Find Safe Alternatives'}
              </button>
              <button
                type="button"
                onClick={() => onUpskillForRole(currentResult.roleTitle)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#11241D] bg-[#FCFDFB] border border-[#CBD8D0] rounded-lg hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors"
              >
                <Compass className="h-3.5 w-3.5 text-[#1B5E43]" />
                Upskill for Role
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskAdvisor(
                    `Review this ${currentResult.riskVerdict} scan (${currentResult.riskScore}% risk) for ${currentResult.roleTitle} at ${currentResult.companyName} (sender: ${currentResult.senderDomain}). What should I check or reply next?`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#11241D] bg-[#FCFDFB] border border-[#CBD8D0] rounded-lg hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5 text-[#1B5E43]" />
                Ask Advisor
              </button>
            </div>

            {/* Live Google Search Grounding Output */}
            {webVerification && (
              <div className="rounded-xl bg-[#F4F7F4] border border-[#DCE6DF] p-4 space-y-2.5">
                <span className="text-xs font-semibold text-[#11241D] inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-[#1B5E43]" />
                  Live Google Search Verification
                </span>
                <p className="text-xs text-[#11241D] whitespace-pre-line leading-relaxed">
                  {webVerification.summary}
                </p>
                {webVerification.sources.length > 0 && (
                  <div className="pt-2.5 border-t border-[#DCE6DF] flex flex-wrap gap-x-4 gap-y-1.5">
                    {webVerification.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#1B5E43] hover:underline max-w-[260px] truncate"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Red Flags Detected */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-[#4A6358] uppercase tracking-wide">
                Red Flags Detected ({currentResult.redFlags.length})
              </h4>
              {currentResult.redFlags.length === 0 ? (
                <p className="text-xs text-[#135D3B] bg-[#E3F5EB] border border-[#B7E4C7] rounded-xl px-4 py-3">
                  No classic scam indicators (advance fee, domain spoofing, or urgency traps) were detected.
                </p>
              ) : (
                <ul className="space-y-2">
                  {currentResult.redFlags.map((flag, idx) => (
                    <li
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-xl bg-[#F4F7F4] border border-[#DCE6DF] px-4 py-3"
                    >
                      <div className="text-xs text-[#4A6358] leading-relaxed">
                        <span className="font-semibold text-[#11241D]">{flag.category}: </span>
                        {flag.detail}
                      </div>
                      <span
                        className={`text-[11px] font-mono font-semibold uppercase shrink-0 ${
                          flag.severity === 'high'
                            ? 'text-[#991B1B]'
                            : flag.severity === 'medium'
                            ? 'text-[#92400E]'
                            : 'text-[#4A6358]'
                        }`}
                      >
                        {flag.severity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Verification Checklist */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-[#4A6358] uppercase tracking-wide">
                  Verification Checklist
                </h4>
                <button
                  type="button"
                  onClick={handleSyncChecklistToTasks}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B5E43] hover:underline"
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  Sync to Google Tasks
                </button>
              </div>
              <ul className="space-y-2">
                {currentResult.verificationChecklist.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-[#11241D]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#1B5E43] mt-0.5 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Workspace Share / Export Bar */}
            <div className="pt-4 border-t border-[#DCE6DF] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-[#4A6358] font-mono">
                Audited with {currentResult.modelUsed}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportReportToDocs}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors whitespace-nowrap shrink-0"
                >
                  <FileText className="h-3.5 w-3.5 text-[#1B5E43]" />
                  Export to Google Docs
                </button>
                <button
                  type="button"
                  onClick={handleOpenChatShare}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#11241D] bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl hover:border-[#1B5E43] hover:bg-[#E6F0EA] transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageSquareShare className="h-3.5 w-3.5 text-[#1B5E43]" />
                  Share to Google Chat
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Full-Width Bottom Bento Strip: Recent Scan History */}
      {scanHistory.length > 0 && (
        <div className="col-span-12 rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-[#11241D]">
              Recent Scan History
            </h3>
            <span className="text-xs text-[#4A6358] tabular-nums">
              {scanHistory.length} saved scans
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {scanHistory.slice(0, 8).map((item) => {
              const s = getRiskStyle(item.riskVerdict);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentResult(item);
                    setWebVerification(null);
                  }}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    currentResult?.id === item.id
                      ? 'border-[#1B5E43] bg-[#E6F0EA]/60'
                      : 'border-[#DCE6DF] bg-[#F4F7F4] hover:border-[#1B5E43]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#11241D] truncate">
                      {item.companyName}
                    </span>
                    <span className={`text-xs font-mono font-bold tabular-nums ${s.text}`}>
                      {item.riskScore}%
                    </span>
                  </div>
                  <p className="text-xs text-[#4A6358] truncate mt-1">
                    {item.riskVerdict} · {item.roleTitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Google Chat Space Picker Modal */}
      {chatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#11241D]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight text-[#11241D]">
                Share Alert to Google Chat
              </h3>
              <button
                type="button"
                onClick={() => setChatModalOpen(false)}
                className="text-xs font-medium text-[#4A6358] hover:text-[#11241D]"
              >
                Close
              </button>
            </div>

            {isLoadingSpaces && (
              <p className="text-xs text-[#4A6358] py-4">Loading Google Chat spaces...</p>
            )}

            {chatError && (
              <div className="rounded-xl bg-[#FEF3C7] border border-[#FDE68A] p-4 space-y-2 text-xs text-[#92400E]">
                <p>{chatError.message}</p>
                {chatError.consoleUrl && (
                  <a
                    href={chatError.consoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#1B5E43] hover:underline"
                  >
                    Open Google Chat API Configuration
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {!isLoadingSpaces && !chatError && chatSpaces.length === 0 && (
              <p className="text-xs text-[#4A6358] py-2">
                No accessible Google Chat spaces were found on this account.
              </p>
            )}

            {!isLoadingSpaces && !chatError && chatSpaces.length > 0 && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-[#4A6358]">
                  Select Target Space
                </label>
                <select
                  value={selectedSpace}
                  onChange={(e) => setSelectedSpace(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD8D0] bg-[#F4F7F4] px-3.5 py-2.5 text-sm text-[#11241D] focus:border-[#1B5E43] focus:outline-none focus:ring-2 focus:ring-[#1B5E43]/25"
                >
                  {chatSpaces.map((sp) => (
                    <option key={sp.name} value={sp.name}>
                      {sp.displayName}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setChatModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-[#11241D] bg-[#FCFDFB] border border-[#CBD8D0] rounded-xl hover:bg-[#E6F0EA]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmChatPost}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1B5E43] rounded-xl hover:bg-[#144733]"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
