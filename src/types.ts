export type PitchLength = "60s" | "3min" | "10min";

// ── Scores ───────────────────────────────────────────────────────────────────

// Generic scoring for 60s and 3min pitches (scale 1–10)
export interface GeneralScores {
  scale: 10;
  structure: number;
  clarity: number;
  problemSolutionFit: number;
  market: number;
  traction: number;
  delivery: number;
}

// Semi-finalist boardroom rubric for 10min pitches (scale 1–5)
export interface SemiFinalistScores {
  scale: 5;
  problem: number;
  solution: number;
  targetMarket: number;
  competition: number;
  businessModel: number;
  gtm: number;
  financials: number;
  team: number;
  presentation: number;
  qa: number;
}

export type Scores = GeneralScores | SemiFinalistScores;

// ── Feedback ─────────────────────────────────────────────────────────────────

export interface BigFix {
  what: string;
  why: string;
  example: string;
}

export interface LineSuggestion {
  before: string;
  after: string;
}

export interface Feedback {
  summary: string;
  scores: Scores;
  bigFixes: BigFix[];
  lineSuggestions: LineSuggestion[];
  judgeNotes: string[];
  judgeQuestions?: string[];   // only for 10-min semi-finalist pitch
  practicePrompt: string;
}

// ── Messages ─────────────────────────────────────────────────────────────────

export interface VideoMeta {
  duration: string;
  timestamp: string;
}

export interface FileMeta {
  name: string;
  ext: string; // e.g. "PDF", "DOCX"
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback?: Feedback;
  isLoading?: boolean;
  videoMeta?: VideoMeta;
  fileMeta?: FileMeta;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export type AIResponse =
  | { type: "feedback"; feedback: Feedback }
  | { type: "chat"; message: string };
