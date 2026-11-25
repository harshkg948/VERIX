import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY') || raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')) {
    return {
      status: 400,
      message: 'API key missing or invalid. Please verify your Gemini API key in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit reached on the Gemini API. Please retry in a moment.',
    };
  }
  return {
    status: 500,
    message: raw || 'Failed to process Gemini request.',
  };
}

function extractGroundingSources(response: any): { title: string; uri: string }[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: { title: string; uri: string }[] = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({ title: title || uri, uri });
    }
  }
  return sources.slice(0, 6);
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// 1. Scam Mail & Offer X-Ray (Single-shot JSON + Optional Image Understanding + Fast/Deep mode)
app.post('/api/xray/analyze', async (req: Request, res: Response) => {
  try {
    const { text, imageBase64, imageMimeType, mode } = req.body as {
      text?: string;
      imageBase64?: string;
      imageMimeType?: string;
      mode?: 'fast' | 'deep';
    };

    if (!text?.trim() && !imageBase64) {
      return res.status(400).json({ error: 'Provide offer text or upload an offer/message screenshot.' });
    }

    const ai = getAiClient();
    const useDeep = mode === 'deep' || Boolean(imageBase64);
    const model = useDeep ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite';

    const prompt = `Analyze the following job/internship email, WhatsApp/Telegram message, or offer letter for employment scam indicators targeting students and job seekers.

Check specifically for:
1. Sender domain mismatch (e.g., @gmail.com / @outlook.com / typo-squatted domain pretending to be an MNC).
2. Advance, registration, security deposit, laptop shipping, or training/certification fees.
3. Unrealistic salary/stipend for minimal experience or zero-interview instant selection.
4. Unverified shortlinks, non-official payment links, WhatsApp/Telegram-only communication.
5. Artificial urgency pressure ("pay within 2 hours or slot expires").
6. Fake CIN/ISO seals or mismatched company details in screenshots if an image is attached.

Be crisp, accurate, and concise. Return JSON only.

CONTENT TO ANALYZE:
${text?.trim() || '[See attached offer letter / message screenshot]'}`;

    const parts: any[] = [];
    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: imageMimeType,
        },
      });
    }
    parts.push({ text: prompt });

    const config: any = {
      systemInstruction:
        'You are VERIX Forensic Auditor, an expert employment fraud detection engine for university students and job seekers. Return compact, factual JSON.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          companyName: { type: Type.STRING, description: 'Detected company or recruiter organization name.' },
          roleTitle: { type: Type.STRING, description: 'Detected job or internship role title.' },
          senderDomain: { type: Type.STRING, description: 'Detected email domain, phone channel, or Unknown.' },
          riskScore: { type: Type.INTEGER, description: 'Risk score from 0 (completely safe) to 100 (confirmed scam).' },
          riskVerdict: {
            type: Type.STRING,
            description: 'Must be exactly one of: Safe, Suspicious, High-Risk Scam',
          },
          summary: { type: Type.STRING, description: '2-sentence crisp verdict summary.' },
          redFlags: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                severity: { type: Type.STRING, description: 'high, medium, or low' },
                detail: { type: Type.STRING },
              },
              required: ['category', 'severity', 'detail'],
            },
          },
          verificationChecklist: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 to 5 concrete steps the candidate should take to verify this recruiter.',
          },
        },
        required: [
          'companyName',
          'roleTitle',
          'senderDomain',
          'riskScore',
          'riskVerdict',
          'summary',
          'redFlags',
          'verificationChecklist',
        ],
      },
    };

    if (useDeep) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config,
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json({
      ...parsed,
      modelUsed: model,
    });
  } catch (err) {
    const formatted = formatApiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

// 1b. Live Google Search Grounding Company & Domain Verification
app.post('/api/verify/company', async (req: Request, res: Response) => {
  try {
    const { companyName, senderDomain, roleTitle } = req.body as {
      companyName?: string;
      senderDomain?: string;
      roleTitle?: string;
    };

    if (!companyName?.trim()) {
      return res.status(400).json({ error: 'Company name is required for web verification.' });
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Verify the legitimacy of this hiring claim using live Google Search:
Company: ${companyName}
Sender Domain / Contact: ${senderDomain || 'Not provided'}
Role: ${roleTitle || 'Not provided'}

Provide a concise 3-4 bullet verification brief covering:
- Official website domain and official careers portal URL
- Whether the sender domain matches the official domain
- Any known job scam warnings or recruitment advisories associated with this company name.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const sources = extractGroundingSources(response);
    return res.json({
      summary: response.text ?? 'No verification data found.',
      sources,
    });
  } catch (err) {
    const formatted = formatApiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

// 2. Safe Job & Portal Matcher (5 tailored roles on verified portals, excluding third-party agencies)
app.post('/api/jobs/match', async (req: Request, res: Response) => {
  try {
    const { profile, useSearchGrounding } = req.body as {
      profile: {
        name: string;
        degreeBranch: string;
        skills: string[];
        preferredRole: string;
        locationPref: string;
      };
      useSearchGrounding?: boolean;
    };

    if (!profile?.preferredRole?.trim()) {
      return res.status(400).json({ error: 'Preferred role is required to find safe matches.' });
    }

    const ai = getAiClient();

    if (useSearchGrounding) {
      const searchResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Find 5 real, current, safe job or internship tracks for this student/candidate, strictly on verified platforms (LinkedIn Jobs, Wellfound, Unstop, Internshala, or Official Company Career Portals). Explicitly exclude unverified third-party staffing/placement agencies or pay-to-apply portals.

Candidate Profile:
- Degree/Branch: ${profile.degreeBranch}
- Skills: ${profile.skills.join(', ')}
- Preferred Role: ${profile.preferredRole}
- Location/Remote: ${profile.locationPref}

Respond ONLY with a valid JSON object matching this shape (no markdown fences):
{
  "matches": [
    {
      "roleTitle": "...",
      "companyType": "...",
      "matchScore": 92,
      "verifiedPlatform": "LinkedIn Jobs | Wellfound | Unstop | Internshala | Official Career Portals",
      "searchUrl": "https://...",
      "salaryRange": "...",
      "whyMatched": "...",
      "safetyNote": "..."
    }
  ]
}`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const rawText = (searchResponse.text ?? '{}').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{"matches":[]}');
      const sources = extractGroundingSources(searchResponse);
      return res.json({
        matches: Array.isArray(parsed.matches) ? parsed.matches.slice(0, 5) : [],
        sources,
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Generate 5 tailored, scam-free job/internship opportunities and direct verified search links for:
- Candidate: ${profile.name} (${profile.degreeBranch})
- Skills: ${profile.skills.join(', ')}
- Preferred Role: ${profile.preferredRole}
- Location Preference: ${profile.locationPref}

Rules:
- Only use verified platforms: LinkedIn Jobs, Wellfound, Unstop, Internshala, or Official Career Portals (e.g., greenhouse.io, lever.co, careers.google.com, careers.microsoft.com).
- Explicitly filter out unverified third-party agencies or fee-charging consultancies.
- Provide valid direct search URLs (e.g. https://www.linkedin.com/jobs/search/?keywords=..., https://wellfound.com/role/..., https://internshala.com/internships/..., https://unstop.com/internships?...).`,
      config: {
        systemInstruction:
          'You are VERIX Safe Career Matcher. Return exactly 5 high-signal matches on verified job portals only.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  roleTitle: { type: Type.STRING },
                  companyType: { type: Type.STRING },
                  matchScore: { type: Type.INTEGER },
                  verifiedPlatform: { type: Type.STRING },
                  searchUrl: { type: Type.STRING },
                  salaryRange: { type: Type.STRING },
                  whyMatched: { type: Type.STRING },
                  safetyNote: { type: Type.STRING },
                },
                required: [
                  'roleTitle',
                  'companyType',
                  'matchScore',
                  'verifiedPlatform',
                  'searchUrl',
                  'salaryRange',
                  'whyMatched',
                  'safetyNote',
                ],
              },
            },
          },
          required: ['matches'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{"matches":[]}').trim());
    return res.json({
      matches: Array.isArray(parsed.matches) ? parsed.matches.slice(0, 5) : [],
      sources: [],
    });
  } catch (err) {
    const formatted = formatApiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

// 4. Skill Gap & Upskill Planner (High Thinking Mode via gemini-4-hydrogen)
app.post('/api/upskill/blueprint', async (req: Request, res: Response) => {
  try {
    const { profile, targetRole, deepThinking } = req.body as {
      profile: {
        degreeBranch: string;
        skills: string[];
        preferredRole: string;
      };
      targetRole: string;
      deepThinking?: boolean;
    };

    if (!targetRole?.trim()) {
      return res.status(400).json({ error: 'Target role is required.' });
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Build a compact, high-signal Upskill Blueprint for a candidate targeting "${targetRole}".

Current Profile:
- Education: ${profile?.degreeBranch || 'Undergraduate / Job Seeker'}
- Current Skills: ${(profile?.skills || []).join(', ') || 'Foundational programming'}

Requirements:
1. Missing High-Demand Skills: 3 to 5 specific tools, frameworks, or engineering concepts missing for "${targetRole}".
2. 4-Week Actionable Roadmap: Concise weekly milestones (2-3 concrete tasks per week).
3. 1 Portfolio Mini-Project Idea: Tailored specifically to prove those missing skills to real hiring managers (avoid generic to-do apps).`,
      config: {
        systemInstruction:
          'You are VERIX Career Strategist. Provide practical, industry-grounded upskill blueprints in compact structured JSON.',
        thinkingConfig: {
          thinkingLevel: deepThinking !== false ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            targetRole: { type: Type.STRING },
            missingSkills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  skill: { type: Type.STRING },
                  priority: { type: Type.STRING, description: 'Critical, High, or Recommended' },
                  reason: { type: Type.STRING },
                },
                required: ['skill', 'priority', 'reason'],
              },
            },
            roadmap: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.INTEGER },
                  theme: { type: Type.STRING },
                  milestones: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['week', 'theme', 'milestones'],
              },
            },
            miniProject: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                problemStatement: { type: Type.STRING },
                techStack: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                recruiterProof: { type: Type.STRING },
              },
              required: ['title', 'problemStatement', 'techStack', 'recruiterProof'],
            },
          },
          required: ['targetRole', 'missingSkills', 'roadmap', 'miniProject'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json(parsed);
  } catch (err) {
    const formatted = formatApiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

// 5. Multi-turn Career Safety Advisor Chatbot (with Google Search Grounding)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { history, message, contextSummary } = req.body as {
      history?: { role: 'user' | 'model'; text: string }[];
      message: string;
      contextSummary?: string;
    };

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const ai = getAiClient();
    const formattedHistory = (history || []).map((item) => ({
      role: item.role,
      parts: [{ text: item.text }],
    }));

    const chat = ai.chats.create({
      model: 'gemini-4-hydrogen',
      history: formattedHistory,
      config: {
        systemInstruction: `You are the VERIX Career Safety Advisor — a practical, protective mentor helping students and job seekers spot fraudulent recruiters, verify company domains, evaluate internship/job offers, and plan safe job searches. Keep responses concise, structured, and actionable. Use Google Search when asked to verify real companies, domains, or recent scam patterns.${contextSummary ? `\n\nActive Candidate Context:\n${contextSummary}` : ''}`,
        tools: [{ googleSearch: {} }],
      },
    });

    const response = await chat.sendMessage({ message });
    const sources = extractGroundingSources(response);

    return res.json({
      text: response.text ?? 'I could not generate a response. Please try again.',
      sources,
    });
  } catch (err) {
    const formatted = formatApiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VERIX server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
