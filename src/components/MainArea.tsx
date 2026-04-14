import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { User } from "firebase/auth";
import type { Message, ConversationTurn, PitchLength, Feedback, GeneralScores, SemiFinalistScores, VideoMeta, FileMeta } from "../types";
import type { ProcessedFile } from "../utils/fileProcessor";
import { getAIResponse, generateSessionTitle } from "../services/geminiService";
import { createSession, saveSession, renameSession } from "../services/chatStorage";
import type { ChatSession } from "../services/chatStorage";
import FileUploadZone from "./FileUploadZone";
import AudioRecorder from "./AudioRecorder";
import VideoRecorder from "./VideoRecorder";
import type { VideoReviewData } from "./VideoRecorder";

type InputMode = "text" | "file" | "audio" | "video";

// ── Score bars ────────────────────────────────────────────────────────────────

const ScoreBars: React.FC<{ entries: { label: string; value: number; max: number }[] }> = ({ entries }) => {
  const scoreColor = (ratio: number) =>
    ratio >= 0.7 ? "#4ade80" : ratio >= 0.4 ? "#fecc07" : "#f87171";

  return (
    <div className="space-y-2.5">
      {entries.map((e) => {
        const ratio = e.value / e.max;
        const color = scoreColor(ratio);
        return (
          <div key={e.label} className="flex items-center gap-3">
            <span className="text-xs w-32 shrink-0" style={{ color: "#9aa0a6" }}>{e.label}</span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "#2a2b2d" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ratio * 100}%`, background: color }} />
            </div>
            <span className="text-xs font-semibold w-8 text-right shrink-0" style={{ color }}>
              {e.value}<span style={{ color: "#5f6368", fontWeight: 400 }}>/{e.max}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

const GeneralScoresSection: React.FC<{ scores: GeneralScores }> = ({ scores }) => (
  <ScoreBars entries={[
    { label: "Structure", value: scores.structure, max: 10 },
    { label: "Clarity", value: scores.clarity, max: 10 },
    { label: "Problem / Solution", value: scores.problemSolutionFit, max: 10 },
    { label: "Market", value: scores.market, max: 10 },
    { label: "Traction", value: scores.traction, max: 10 },
    { label: "Delivery", value: scores.delivery, max: 10 },
  ]} />
);

const SemiFinalistScoresSection: React.FC<{ scores: SemiFinalistScores }> = ({ scores }) => (
  <ScoreBars entries={[
    { label: "Problem", value: scores.problem, max: 5 },
    { label: "Solution", value: scores.solution, max: 5 },
    { label: "Target Market", value: scores.targetMarket, max: 5 },
    { label: "Competition", value: scores.competition, max: 5 },
    { label: "Business Model", value: scores.businessModel, max: 5 },
    { label: "Go-to-Market", value: scores.gtm, max: 5 },
    { label: "Financials", value: scores.financials, max: 5 },
    { label: "Team", value: scores.team, max: 5 },
    { label: "Presentation", value: scores.presentation, max: 5 },
    { label: "Q&A Readiness", value: scores.qa, max: 5 },
  ]} />
);

// ── Feedback card ─────────────────────────────────────────────────────────────

const FeedbackCard: React.FC<{ feedback: Feedback }> = ({ feedback }) => {
  const isSemiFinalist = feedback.scores.scale === 5;
  const [expandedFixes, setExpandedFixes] = useState<Set<number>>(new Set());

  const toggleFix = (i: number) => {
    setExpandedFixes(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed" style={{ color: "#e3e3e3" }}>{feedback.summary}</p>

      {isSemiFinalist
        ? <SemiFinalistScoresSection scores={feedback.scores as SemiFinalistScores} />
        : <GeneralScoresSection scores={feedback.scores as GeneralScores} />}

      {feedback.bigFixes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#5f6368" }}>Top Fixes</p>
          {feedback.bigFixes.map((fix, i) => {
            const isOpen = expandedFixes.has(i);
            const preview = fix.why.split(".")[0] + ".";
            return (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: "#1e1f20", border: "1px solid #2a2b2d" }}>
                <button
                  onClick={() => toggleFix(i)}
                  className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left transition"
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "#e3e3e3" }}>{fix.what}</p>
                    {!isOpen && <p className="text-xs mt-0.5 truncate" style={{ color: "#5f6368" }}>{preview}</p>}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="shrink-0 mt-0.5 transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-2" style={{ borderTop: "1px solid #2a2b2d" }}>
                    <p className="text-xs pt-3" style={{ color: "#9aa0a6" }}>{fix.why}</p>
                    <p className="text-xs italic" style={{ color: "#4ade80" }}>"{fix.example}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {feedback.lineSuggestions && feedback.lineSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#5f6368" }}>Line Suggestions</p>
          <div className="space-y-2">
            {feedback.lineSuggestions.map((s, i) => (
              <div key={i} className="rounded-xl overflow-hidden text-xs" style={{ border: "1px solid #2a2b2d" }}>
                <div className="flex items-start gap-2.5 px-3 py-2.5" style={{ borderBottom: "1px solid #2a2b2d" }}>
                  <span className="shrink-0 font-semibold mt-px" style={{ color: "#f87171" }}>Before</span>
                  <p className="leading-relaxed" style={{ color: "#9aa0a6", textDecoration: "line-through" }}>{s.before}</p>
                </div>
                <div className="flex items-start gap-2.5 px-3 py-2.5">
                  <span className="shrink-0 font-semibold mt-px" style={{ color: "#4ade80" }}>After</span>
                  <p className="leading-relaxed" style={{ color: "#e3e3e3" }}>{s.after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.judgeNotes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#5f6368" }}>Judge Perspective</p>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2a2b2d" }}>
            {feedback.judgeNotes.map((note, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-2.5 text-xs"
                style={{
                  borderBottom: i < feedback.judgeNotes.length - 1 ? "1px solid #2a2b2d" : "none",
                  color: "#bdc1c6",
                }}
              >
                <span className="shrink-0 mt-px" style={{ color: "#5f6368" }}>💭</span>
                <span className="leading-relaxed">{note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.judgeQuestions && feedback.judgeQuestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#5f6368" }}>Likely Judge Questions</p>
          <ul className="space-y-2">
            {feedback.judgeQuestions.map((q, i) => (
              <li key={i} className="text-xs flex gap-2" style={{ color: "#fde68a" }}>
                <span className="shrink-0" style={{ color: "#ca8a04" }}>Q{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.practicePrompt && (
        <div className="rounded-xl p-3" style={{ border: "1px solid #2a2b2d" }}>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "#5f6368" }}>Practice</p>
          <p className="text-xs" style={{ color: "#bdc1c6" }}>{feedback.practicePrompt}</p>
        </div>
      )}
    </div>
  );
};

// ── Message bubble ────────────────────────────────────────────────────────────

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  if (message.role === "user") {
    const cardStyle = { background: "rgba(255,255,255,0.04)", border: "1px solid #3c4043" };
    const bubbleStyle = { background: "#2a2b2d", color: "#e3e3e3", borderRadius: "16px 4px 16px 16px" };

    if (message.videoMeta) {
      return (
        <div className="flex justify-end">
          <div className="flex flex-col gap-2 max-w-xl items-end">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={cardStyle}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#ef4444" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#e3e3e3" }}>Video Pitch</p>
                <p className="text-xs" style={{ color: "#9aa0a6" }}>{message.videoMeta.duration} · {message.videoMeta.timestamp}</p>
              </div>
            </div>
            {message.content && (
              <div className="max-w-xl px-4 py-3 text-sm whitespace-pre-wrap" style={bubbleStyle}>
                {message.content}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (message.fileMeta) {
      return (
        <div className="flex justify-end">
          <div className="flex flex-col gap-2 max-w-xl items-end">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={cardStyle}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#ef4444" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#e3e3e3" }}>{message.fileMeta.name}</p>
                <p className="text-xs" style={{ color: "#9aa0a6" }}>{message.fileMeta.ext}</p>
              </div>
            </div>
            {message.content && (
              <div className="max-w-xl px-4 py-3 text-sm whitespace-pre-wrap" style={bubbleStyle}>
                {message.content}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-end">
        <div
          className="max-w-xl rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap"
          style={{ background: "#2a2b2d", color: "#e3e3e3" }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-2xl w-full">
        {message.isLoading ? (
          <div className="flex items-center gap-2 text-sm px-1" style={{ color: "#5f6368" }}>
            <span className="animate-pulse">Thinking…</span>
          </div>
        ) : message.feedback ? (
          <div className="rounded-2xl px-5 py-5" style={{ background: "#1e1f20", border: "1px solid #2a2b2d" }}>
            <FeedbackCard feedback={message.feedback} />
          </div>
        ) : (
          <div className="text-sm leading-relaxed px-1" style={{ color: "#e3e3e3" }}>
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold" style={{ color: "#e3e3e3" }}>{children}</strong>,
                ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-3 space-y-4">{children}</ol>,
                ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-3 space-y-3">{children}</ul>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h1: ({ children }) => <h1 className="font-semibold text-base mb-2 mt-4 first:mt-0" style={{ color: "#e3e3e3" }}>{children}</h1>,
                h2: ({ children }) => <h2 className="font-semibold text-sm mb-2 mt-4 first:mt-0" style={{ color: "#e3e3e3" }}>{children}</h2>,
                h3: ({ children }) => <h3 className="font-medium text-sm mb-1.5 mt-3 first:mt-0" style={{ color: "#c4c4c4" }}>{children}</h3>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Hamburger icon ────────────────────────────────────────────────────────────

// Sidebar closed → click to open (left panel filled)
const SidebarOpenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <rect x="3" y="3" width="6" height="18" rx="2" fill="currentColor" stroke="none" />
  </svg>
);

// Sidebar open → click to close (left panel outlined only)
const SidebarCloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

// ── Send icon ─────────────────────────────────────────────────────────────────

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

// ── Main area ─────────────────────────────────────────────────────────────────

interface MainAreaProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
  onNewSession: () => void;
  user: User | null;
  activeSession: ChatSession | null;
  onSessionCreated: (id: string) => void;
  onSessionUpdated: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

const MainArea: React.FC<MainAreaProps> = ({
  onMenuClick, sidebarOpen, onNewSession, user, activeSession, onSessionCreated, onSessionUpdated, onSignIn, onSignOut,
}) => {
  const [mode, setMode] = useState<InputMode>("text");
  const [isPitchMode, setIsPitchMode] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const pitchButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 4, width: 0 });
  const [textValue, setTextValue] = useState("");
  const [pitchLength, setPitchLength] = useState<PitchLength>(activeSession?.pitchLength ?? "60s");
  const [messages, setMessages] = useState<Message[]>(activeSession?.messages ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<ProcessedFile | null>(null);
  const conversationHistory = useRef<ConversationTurn[]>(activeSession?.history ?? []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | null>(activeSession?.id ?? null);
  const isFirstMessage = useRef<boolean>(!activeSession);

  const hasMessages = messages.length > 0;

  // Helper: persist messages to Firestore after each AI response
  const persistSession = async (
    updatedMessages: Message[],
    updatedHistory: ConversationTurn[],
    firstUserText: string,
    aiResponseText: string
  ) => {
    if (!user) return;
    if (!sessionIdRef.current) {
      // Create session with placeholder title first
      const id = await createSession(user.uid, firstUserText, pitchLength);
      sessionIdRef.current = id;
      await saveSession(user.uid, id, updatedMessages, updatedHistory);
      onSessionCreated(id);
      isFirstMessage.current = false;
      // Auto-generate a better title in the background
      generateSessionTitle(firstUserText, aiResponseText).then((title) => {
        if (sessionIdRef.current && user)
          renameSession(user.uid, sessionIdRef.current, title).then(onSessionUpdated);
      });
    } else {
      await saveSession(user.uid, sessionIdRef.current, updatedMessages, updatedHistory);
      onSessionUpdated();
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useLayoutEffect(() => {
    // Index 0 = Chat, indices 1-3 = pitch lengths
    const activeIndex = !isPitchMode ? 0 : pitchLengths.findIndex(p => p.id === pitchLength) + 1;
    const btn = pitchButtonRefs.current[activeIndex];
    if (btn) setPillStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [pitchLength, isPitchMode]);

  const handleVideoSend = async (data: VideoReviewData) => {
    if (isLoading) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}`;

    const statsText =
      `Body language summary: Eye contact ${data.stats.eyeContactPct}%, ` +
      `Good posture ${data.stats.goodPosturePct}%, ` +
      `Confident expression ${data.stats.smilingPct}%, ` +
      `Composed/still ${data.stats.stablePct}%.`;

    const durationLabel: Record<string, string> = { "60s": "1 min", "3min": "3 min", "10min": "10 min" };
    const videoMeta: VideoMeta = {
      duration: durationLabel[pitchLength],
      timestamp: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: data.transcript || "", videoMeta },
      { id: assistantId, role: "assistant", content: "", isLoading: true },
    ]);
    setIsLoading(true);

    try {
      const aiResponse = await getAIResponse(
        data.transcript || "Please analyze this video pitch.",
        conversationHistory.current,
        pitchLength,
        undefined,
        { snapshot: data.snapshot, stats: statsText },
        isPitchMode
      );

      if (aiResponse.type === "feedback") {
        conversationHistory.current = [
          ...conversationHistory.current,
          { role: "user", content: data.transcript },
          { role: "assistant", content: "[Pitch analysis provided with scores and feedback]" },
        ];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: aiResponse.feedback.summary, feedback: aiResponse.feedback, isLoading: false }
              : m
          )
        );
      } else {
        conversationHistory.current = [
          ...conversationHistory.current,
          { role: "user", content: data.transcript },
          { role: "assistant", content: aiResponse.message },
        ];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: aiResponse.message, isLoading: false }
              : m
          )
        );
      }
    } catch (err) {
      console.error("Video pitch feedback error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong. Please try again.", isLoading: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const text = overrideText ?? textValue.trim();
    const fileToSend = overrideText ? null : attachedFile;
    if ((!text && !fileToSend) || isLoading) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}`;
    const fileMeta: FileMeta | undefined = fileToSend
      ? { name: fileToSend.name, ext: fileToSend.name.split(".").pop()?.toUpperCase() || "FILE" }
      : undefined;
    const baseMessages = messages;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: text, fileMeta },
      { id: assistantId, role: "assistant", content: "", isLoading: true },
    ]);
    if (!overrideText) {
      setTextValue("");
      setAttachedFile(null);
    }
    setIsLoading(true);

    try {
      const aiResponse = await getAIResponse(
        text || "Please analyze this pitch document.",
        conversationHistory.current,
        pitchLength,
        fileToSend ?? undefined,
        undefined,
        isPitchMode
      );

      if (aiResponse.type === "feedback") {
        const newHistory: ConversationTurn[] = [
          ...conversationHistory.current,
          { role: "user", content: text },
          { role: "assistant", content: "[Pitch analysis provided with scores and feedback]" },
        ];
        conversationHistory.current = newHistory;
        const updatedMessages: Message[] = [
          ...baseMessages,
          { id: userId, role: "user", content: text, fileMeta },
          { id: assistantId, role: "assistant", content: aiResponse.feedback.summary, feedback: aiResponse.feedback, isLoading: false },
        ];
        setMessages(updatedMessages);
        persistSession(updatedMessages, newHistory, fileMeta ? fileMeta.name : text, aiResponse.feedback.summary);
      } else {
        const newHistory: ConversationTurn[] = [
          ...conversationHistory.current,
          { role: "user", content: text },
          { role: "assistant", content: aiResponse.message },
        ];
        conversationHistory.current = newHistory;
        const updatedMessages: Message[] = [
          ...baseMessages,
          { id: userId, role: "user", content: text, fileMeta },
          { id: assistantId, role: "assistant", content: aiResponse.message, isLoading: false },
        ];
        setMessages(updatedMessages);
        persistSession(updatedMessages, newHistory, fileMeta ? fileMeta.name : text, aiResponse.message);
      }
    } catch (err) {
      console.error("Pitch feedback error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong. Please try again.", isLoading: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const tabs: { id: InputMode; label: string }[] = [
    { id: "text", label: "Text" },
    { id: "file", label: "File" },
    { id: "audio", label: "Audio" },
    { id: "video", label: "Video" },
  ];

  const pitchLengths: { id: PitchLength; label: string; description: string }[] = [
    { id: "60s", label: "60 sec", description: "Elevator pitch" },
    { id: "3min", label: "3 min", description: "Grand Final" },
    { id: "10min", label: "10 min", description: "Semi-Final" },
  ];

  // ── Input box (shared between centered + bottom layouts) ──────────────────

  const tabIcons: Record<InputMode, React.ReactNode> = {
    text: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    file: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    audio: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    ),
    video: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
  };

  const InputBox = (
    <div
      className="overflow-hidden"
      style={{ background: "#1e1f20", border: "1px solid #2a2b2d", borderRadius: "28px" }}
    >

      {/* Input content */}
      <div className="px-4 pt-3 min-h-[68px]">
        {mode === "text" && (
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isPitchMode ? "Paste or type your pitch…" : "Ask a question…"}
              rows={2}
              className="flex-1 text-sm resize-none focus:outline-none"
              style={{ background: "transparent", color: "#e3e3e3", caretColor: "#e3e3e3" }}
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !textValue.trim()}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition"
              style={{
                background: isLoading || !textValue.trim() ? "#2a2b2d" : "#fecc07",
                color: isLoading || !textValue.trim() ? "#5f6368" : "#131314",
              }}
            >
              <SendIcon />
            </button>
          </div>
        )}

        {mode === "file" && (
          <div className="space-y-2">
            <FileUploadZone onFileReady={setAttachedFile} currentFile={attachedFile} />
            {attachedFile && (
              <div className="flex items-end gap-2">
                <textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Add a message (optional)…"
                  rows={2}
                  className="flex-1 text-sm resize-none focus:outline-none"
                  style={{ background: "transparent", color: "#e3e3e3", caretColor: "#e3e3e3" }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition"
                  style={{
                    background: isLoading ? "#2a2b2d" : "#fecc07",
                    color: isLoading ? "#5f6368" : "#131314",
                  }}
                >
                  <SendIcon />
                </button>
              </div>
            )}
          </div>
        )}

        {mode === "audio" && (
          <AudioRecorder onSend={(transcript) => handleSend(transcript)} isLoading={isLoading} />
        )}

        {mode === "video" && (
          <VideoRecorder onSend={handleVideoSend} isLoading={isLoading} pitchLength={pitchLength} onRecordingChange={setIsVideoRecording} />
        )}
      </div>

      {/* Mode toolbar */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition"
            style={{
              background: mode === tab.id ? "#2a2b2d" : "transparent",
              color: mode === tab.id ? "#e3e3e3" : "#9aa0a6",
            }}
            onMouseEnter={(e) => { if (mode !== tab.id) e.currentTarget.style.color = "#e3e3e3"; }}
            onMouseLeave={(e) => { if (mode !== tab.id) e.currentTarget.style.color = "#9aa0a6"; }}
          >
            {tabIcons[tab.id]}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="flex-1 flex flex-col overflow-hidden relative" style={{ transition: "margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)" }}>
      {/* Top bar — always visible */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0 relative">
        <div className="flex items-center gap-2">
          {!sidebarOpen && (
            <button
              onClick={onMenuClick}
              className="p-2 rounded-lg transition"
              style={{ color: "#9aa0a6" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2b2d")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <SidebarOpenIcon />
            </button>
          )}
          <span className="text-sm font-medium" style={{ color: "#e3e3e3" }}>AI Pitch Coach</span>
        </div>

        {/* Merged pill — top center */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="relative flex items-center gap-0.5 rounded-full px-1 py-0.5" style={{ background: "#1e1f20", border: "1px solid #2a2b2d" }}>
            {/* Sliding pill */}
            <span
              className="absolute rounded-full pointer-events-none transition-all duration-200"
              style={{
                top: 3, bottom: 3,
                left: pillStyle.left,
                width: pillStyle.width,
                background: "#2a2b2d",
              }}
            />
            {/* Chat option */}
            <button
              ref={el => { pitchButtonRefs.current[0] = el; }}
              onClick={() => setIsPitchMode(false)}
              className="relative z-10 px-3 py-1 rounded-full font-medium transition-colors duration-200"
              style={{ background: "transparent", color: !isPitchMode ? "#e3e3e3" : "#5f6368", fontSize: 11 }}
            >
              Chat
            </button>
            {/* Divider */}
            <span className="shrink-0" style={{ width: 1, height: 10, background: "#3c4043", display: "inline-block", margin: "0 2px" }} />
            {/* Pitch length options */}
            {pitchLengths.map((p, i) => (
              <button
                key={p.id}
                ref={el => { pitchButtonRefs.current[i + 1] = el; }}
                onClick={() => { setIsPitchMode(true); setPitchLength(p.id); }}
                className="relative z-10 px-3 py-1 rounded-full font-medium transition-colors duration-200"
                style={{ background: "transparent", color: isPitchMode && pitchLength === p.id ? "#e3e3e3" : "#5f6368", fontSize: 11 }}
              >
                {p.label}
              </button>
            ))}
            {/* Badge — only in pitch mode */}
            {isPitchMode && (
              <>
                <span className="shrink-0 mx-1" style={{ width: 1, height: 10, background: "#3c4043", display: "inline-block" }} />
                {pitchLength === "60s" && (
                  <span className="relative z-10 px-2.5 py-1 rounded-full font-medium" style={{ color: "#4ade80", background: "#0d1f12", fontSize: 11 }}>Quick</span>
                )}
                {pitchLength === "3min" && (
                  <span className="relative z-10 px-2.5 py-1 rounded-full font-medium" style={{ color: "#60a5fa", background: "#0d1b2e", fontSize: 11 }}>Grand Finale</span>
                )}
                {pitchLength === "10min" && (
                  <span className="relative z-10 px-2.5 py-1 rounded-full font-medium" style={{ color: "#ca8a04", background: "#1a1400", fontSize: 11 }}>Boardroom</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Auth — top right */}
        <div className="flex items-center gap-3">
        <div className="relative">
          {user ? (
            <div className="relative group">
              <button className="flex items-center gap-2 rounded-full p-0.5 transition" title={user.displayName ?? ""}>
                {user.photoURL
                  ? <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                  : <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ background: "#fecc07", color: "#131314" }}>{user.displayName?.[0]}</div>
                }
              </button>
              {/* Dropdown on hover */}
              <div
                className="absolute right-0 top-10 rounded-xl py-1 min-w-[160px] opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity"
                style={{ background: "#1e1f20", border: "1px solid #2a2b2d", zIndex: 50 }}
              >
                <div className="px-3 py-2" style={{ borderBottom: "1px solid #2a2b2d" }}>
                  <p className="text-sm font-medium truncate" style={{ color: "#e3e3e3" }}>{user.displayName}</p>
                  <p className="text-xs truncate" style={{ color: "#5f6368" }}>{user.email}</p>
                </div>
                <button
                  onClick={onSignOut}
                  className="w-full text-left px-3 py-2 text-sm transition"
                  style={{ color: "#9aa0a6" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#e3e3e3")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9aa0a6")}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full text-sm font-medium transition-shadow"
              style={{
                background: "transparent",
                color: "#e3e3e3",
                fontFamily: "Roboto, sans-serif",
                border: "1px solid #3c4043",
                boxShadow: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#9aa0a6";
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#3c4043";
                e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Official Google G logo */}
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <g fill="none" fillRule="evenodd">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </g>
              </svg>
              Sign in with Google
            </button>
          )}
        </div>
        </div>
      </header>

      {/* ── Empty state: greeting + input centered together ── */}
      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">
          <div className="w-full max-w-2xl space-y-6">
            {/* Greeting */}
            {!isVideoRecording && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="#fecc07" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                    className="rocket-float"
                  >
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                  </svg>
                  <span className="text-base" style={{ color: "#9aa0a6", lineHeight: 1 }}>Hi! I'm your AI Pitch Coach</span>
                </div>
                <h1 className="text-4xl font-medium" style={{ color: "#e3e3e3" }}>
                  Ready to pitch?
                </h1>
              </div>
            )}
            {/* Input */}
            {InputBox}
          </div>
        </div>
      )}

      {/* ── Chat state: messages scroll + input pinned to bottom ── */}
      {hasMessages && (
        <>
          <div className="flex-1 overflow-y-auto scroll-thin px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="shrink-0 px-4 pb-4 relative" style={{ zIndex: 10 }}>
            {/* Fade gradient — sits above the input box, overlapping the scroll area */}
            <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom: "100%", height: 80, background: "linear-gradient(to bottom, transparent, #131314)" }} />
            <div className="max-w-2xl mx-auto">
              {InputBox}
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default MainArea;
