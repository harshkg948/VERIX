# 🛡️ VERIX — AI-Powered Job Scam Detector & Safe Career Ecosystem

> **Built for AI Vibeathon 2026 (PromptWars × Echo Engineers)**  
> Protecting students and early-career job seekers from fraudulent recruitment traps while guiding them toward verified opportunities, organized tracking, and targeted upskilling.

---

## 📌 Overview

Every year, thousands of students and fresh graduates fall prey to fake internship offers, upfront registration/laptop fee scams, phishing domains, and unverified WhatsApp recruitment pitches. **VERIX** solves this by uniting fraud forensics and career progression into a single connected workspace.

Rather than acting as a standalone scam checker, VERIX closes the entire job-search loop: **Detect Scams → Discover Verified Roles → Track Applications → Close Skill Gaps**, deeply integrated with **Google Workspace** and powered by **Gemini**.

---

## ✨ Core Modules & Connected Workflow

### 1. 🔍 Scam Mail & Offer X-Ray
- **Multi-Source Intake:** Paste suspicious emails or WhatsApp pitches, upload offer-letter screenshots (multimodal vision analysis), or import messages directly from **Gmail**.
- **Dual-Speed Forensics:** Switch between **Fast Triage** for instant screening and **Deep Forensic Analysis** for thorough inspection.
- **0–100% Scam Risk Gauge:** Categorizes offers into **Safe**, **Suspicious**, or **High-Risk Scam** with clear red-flag breakdowns (sender domain mismatches, upfront security/laptop deposits, urgency manipulation, unrealistic compensation).
- **Live Company Verification:** Uses **Google Search Grounding** to cross-check company legitimacy, official career domains, and known scam reports.
- **One-Click Actions:** Log results to the Tracker, export forensic reports to **Google Docs**, sync verification checklists to **Google Tasks**, broadcast warnings to **Google Chat**, or pivot straight to **Find Safe Alternatives**.

### 2. 🎯 Safe Job & Portal Matcher
- **Smart Candidate Profile:** Automatically syncs with your Google account name alongside your degree, technical skills, preferred role, and location preferences.
- **Verified-Only Discovery:** Generates **5 tailored job or internship tracks** sourced strictly from trusted platforms (**LinkedIn Jobs**, **Wellfound**, **Unstop**, **Internshala**, and **Official Company Career Portals**), filtering out unverified third-party agencies.
- **Connected Actions:** Every match card supports 1-click **Track Application**, **Build Upskill Plan**, or **Ask Advisor**.

### 3. 📊 Application Tracker
- **At-a-Glance Metrics:** Live counters for **Total Applied**, **Interviews**, **Verified Safe**, and **Scams Avoided**.
- **Interactive Pipeline Table:** Searchable and filterable table featuring Safety Status badges and editable application stages (`Applied`, `Assessment`, `Interview`, `Offer`, `Rejected`, `Blocked Scam`).
- **Workspace & Workflow Hooks:** Schedule interviews directly on **Google Calendar**, re-scan suspicious entries in **X-Ray**, launch role-specific **Upskill Plans**, prep with the **Advisor**, or export the full tracker to **Google Sheets**.

### 4. 🚀 Skill Gap & Upskill Planner
- **Targeted Gap Analysis:** Compares your active Candidate Profile against any target role to pinpoint high-demand missing skills.
- **4-Week Actionable Roadmap:** Generates structured weekly learning milestones plus a recruiter-ready **Portfolio Mini-Project**.
- **Closed-Loop Progression:** Mark skills as learned to automatically update your Candidate Profile, sync weekly milestones to **Google Tasks**, save blueprints to **Google Docs**, or search verified roles matching your upgraded skill set.

### 5. 💬 Career Safety Advisor (Persistent AI Copilot)
- A context-aware, multi-turn chat drawer grounded with live **Google Search**.
- Understands your active profile, recent X-Ray scans, and tracked pipeline to answer questions on recruiter legitimacy, offer-letter clauses, compensation negotiation, and tailored interview preparation.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Tailwind CSS | Responsive desktop bento dashboard with an organic botanical UI |
| **AI Engine** | Google Gemini API (`gemini-2.5-flash`) | Structured JSON extraction, multimodal offer screenshot analysis, & multi-turn reasoning |
| **Grounding** | Google Search Grounding | Real-time company domain verification and up-to-date job/recruiter checks |
| **Workspace Integrations** | Gmail, Docs, Sheets, Tasks, Calendar, Chat | Seamless export, task syncing, scheduling, and alert sharing |
| **State Persistence** | Browser `localStorage` + Google Profile Sync | Instant client-side persistence across scans, profile updates, and application stages |

---

## 🔄 End-to-End User Flow

```text
[Suspicious Email / Screenshot / Gmail]
                 │
                 ▼
      ┌─────────────────────┐
      │  Scam Mail X-Ray    │──► High Risk ──► Block in Tracker + Alert on Google Chat
      └─────────────────────┘
                 │
                 ▼ (Find Safe Alternatives)
      ┌─────────────────────┐
      │ Safe Portal Matcher │──► Verified Roles (LinkedIn, Wellfound, Unstop, Official)
      └─────────────────────┘
                 │
                 ▼ (+ Track Application)
      ┌─────────────────────┐
      │ Application Tracker │──► Schedule on Google Calendar / Export to Google Sheets
      └─────────────────────┘
                 │
                 ▼ (Build Upskill Plan)
      ┌─────────────────────┐
      │  Upskill Planner    │──► 4-Week Roadmap ──► Sync to Google Tasks & Update Profile
      └─────────────────────┘
```

---

## 🚀 Getting Started (Local Setup)

### Prerequisites
- **Node.js** (v18+ recommended)
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/verix-career-shield.git
   cd verix-career-shield
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser to explore the dashboard.

---

## 🏆 Hackathon Highlights (AI Vibeathon 2026)
- **Zero-Friction Safety:** Combines multimodal screenshot inspection and live Search grounding so students can verify sketchy off-campus offers in seconds.
- **Actionable Ecosystem:** Connects scam detection directly to verified job discovery, application tracking, and skill-building rather than stopping at a warning label.
- **Deep Google Workspace Synergy:** Turns AI insights into real productivity artifacts across Gmail, Docs, Sheets, Tasks, Calendar, and Chat.

---

## 📄 License
Distributed under the MIT License. Built with ❤️ for students and job seekers everywhere.