import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Leaf, Send, Trash2, X } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatAdvisorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contextSummary: string;
  pendingPrompt: { id: number; text: string } | null;
  onConsumePendingPrompt: () => void;
}

const SUGGESTED_PROMPTS = [
  'How do I verify if an internship recruiter domain is real?',
  'Is a refundable security deposit for a work laptop ever legitimate?',
  'What questions should I ask in a startup screening call?',
];

export const ChatAdvisorDrawer: React.FC<ChatAdvisorDrawerProps> = ({
  isOpen,
  onClose,
  contextSummary,
  pendingPrompt,
  onConsumePendingPrompt,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: 'Hello! I am your VERIX Career Safety Advisor. Paste any suspicious recruiter detail, ask me to verify a company domain using Google Search, or ask for interview safety guidance.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastConsumedPromptId = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || isSending) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: content,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!textToSend) setInput('');
    setIsSending(true);

    try {
      const historyPayload = nextMessages
        .slice(0, -1)
        .filter((m) => m.id !== 'welcome-1')
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyPayload,
          message: content,
          contextSummary,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to get advisor response.');
      }

      const modelMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.text,
        sources: data.sources || [],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (
      isOpen &&
      pendingPrompt &&
      pendingPrompt.id !== lastConsumedPromptId.current &&
      !isSending
    ) {
      lastConsumedPromptId.current = pendingPrompt.id;
      sendMessage(pendingPrompt.text);
      onConsumePendingPrompt();
    }
  }, [isOpen, pendingPrompt, isSending]);

  if (!isOpen) return null;

  const resetChat = () => {
    setMessages([
      {
        id: 'welcome-1',
        role: 'model',
        text: 'Conversation cleared. Ask any question about job offer verification, recruiter domains, or safe career planning.',
        timestamp: new Date().toISOString(),
      },
    ]);
    setError(null);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[440px] max-w-full bg-[#FCFDFB] border-l border-[#DCE6DF] shadow-[0_12px_40px_-8px_rgba(17,36,29,0.18)] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCE6DF] bg-[#FCFDFB]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-[#E3F5EB] border border-[#B7E4C7] flex items-center justify-center text-[#135D3B]">
            <Leaf className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[#11241D]">
              Career Safety Advisor
            </h2>
            <p className="text-xs text-[#4A6358]">Multi-turn guidance · Google Search enabled</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetChat}
            title="Clear chat history"
            className="p-2 rounded-lg text-[#4A6358] hover:text-[#11241D] hover:bg-[#E6F0EA] transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close advisor"
            className="p-2 rounded-lg text-[#4A6358] hover:text-[#11241D] hover:bg-[#E6F0EA] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[#F4F7F4]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#1B5E43] text-white shadow-xs'
                  : 'bg-[#FCFDFB] border border-[#DCE6DF] text-[#11241D] shadow-[0_4px_20px_-4px_rgba(20,54,41,0.06)]'
              }`}
            >
              {msg.text}
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-2 max-w-[88%] space-y-1 px-1">
                <p className="text-[11px] font-semibold text-[#4A6358]">Verified Web Sources</p>
                <div className="flex flex-col gap-1">
                  {msg.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1B5E43] hover:underline truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex items-start">
            <div className="rounded-2xl px-4 py-2.5 text-xs text-[#4A6358] bg-[#FCFDFB] border border-[#DCE6DF]">
              Analyzing and verifying...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-[#FEE2E2] border border-[#FECACA] px-3.5 py-2.5 text-xs text-[#991B1B]">
            {error}
          </div>
        )}
      </div>

      {messages.length <= 2 && (
        <div className="px-5 py-3 border-t border-[#DCE6DF] bg-[#FCFDFB] space-y-1.5">
          <p className="text-[11px] font-semibold text-[#4A6358]">Quick prompts</p>
          <div className="flex flex-col gap-1">
            {SUGGESTED_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="text-left text-xs text-[#11241D] hover:text-[#1B5E43] py-1.5 px-2.5 rounded-lg hover:bg-[#E6F0EA] transition-colors truncate"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-4 border-t border-[#DCE6DF] bg-[#FCFDFB] flex items-center gap-2.5"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about an offer, company, or domain..."
          className="flex-1 px-3.5 py-2.5 text-sm bg-[#F4F7F4] border border-[#CBD8D0] rounded-xl text-[#11241D] placeholder:text-[#4A6358]/70 focus:outline-none focus:border-[#1B5E43] focus:ring-2 focus:ring-[#1B5E43]/25"
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[#1B5E43] text-white text-xs font-semibold hover:bg-[#144733] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
};
