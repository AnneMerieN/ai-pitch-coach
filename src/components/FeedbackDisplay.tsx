import React from "react";
import type { Feedback } from "../types";
import { Sparkles, Target, ListChecks, Quote, ArrowRight } from "lucide-react";

interface FeedbackDisplayProps {
  feedback: Feedback;
}

const scoreLabel = (score: number | null | undefined): string => {
  if (score == null) return "N/A";
  if (score >= 9) return "Excellent";
  if (score >= 7) return "Very good";
  if (score >= 5) return "Good";
  if (score >= 3) return "Average";
  if (score >= 1) return "Poor";
  return "Missing";
};

const scoreColor = (score: number | null | undefined): string => {
  if (score == null) return "bg-neutral-700";
  if (score >= 9) return "bg-emerald-400";
  if (score >= 7) return "bg-lime-400";
  if (score >= 5) return "bg-amber-400";
  if (score >= 3) return "bg-orange-400";
  if (score >= 1) return "bg-rose-500";
  return "bg-neutral-700";
};

const ScoreCard: React.FC<{ label: string; score?: number | null }> = ({ label, score }) => {
  const labelText = scoreLabel(score ?? null);
  const percent = score == null || score < 0 ? 0 : score > 10 ? 100 : (score / 10) * 100;
  const colorClass = scoreColor(score ?? null);
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#050712] px-3.5 py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-neutral-200">{label}</p>
          <p className="text-[11px] text-neutral-500">{labelText}</p>
        </div>
        <div className="text-lg font-semibold text-neutral-50">
          {score != null ? score.toFixed(1) : "–"}
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-neutral-900 overflow-hidden">
        <div className={`h-full ${colorClass} transition-[width] duration-500`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ feedback }) => {
  const { summary, scores, bigFixes, lineSuggestions, judgeNotes, practicePrompt } = feedback;
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="inline-flex items-center gap-2 text-neutral-300">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="font-medium tracking-wide uppercase">Judge-style feedback</span>
        </div>
        <span className="inline-flex items-center rounded-full border border-neutral-700/70 px-2 py-0.5 text-[10px] text-neutral-400 uppercase tracking-wide">
          Draft guidance
        </span>
      </div>

      {summary && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 flex items-center gap-1.5">
            <Target className="w-3 h-3 text-emerald-400" /> Pitch summary
          </h3>
          <div className="border-l-2 border-emerald-500/70 pl-3 py-1">
            <p className="text-sm text-neutral-100 whitespace-pre-wrap">{summary}</p>
          </div>
        </section>
      )}

      {scores && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Overall scorecard (1–10)</h3>
            <span className="text-[10px] text-neutral-500">Higher scores ≈ stronger rubric performance</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ScoreCard label="Structure & Flow" score={scores.structure} />
            <ScoreCard label="Clarity & Focus" score={scores.clarity} />
            <ScoreCard label="Problem–Solution Fit" score={scores.problemSolutionFit} />
            <ScoreCard label="Market & Differentiation" score={scores.market} />
            <ScoreCard label="Traction / Evidence" score={scores.traction} />
            <ScoreCard label="Delivery & Storytelling" score={scores.delivery} />
            {typeof scores.bodyLanguage === "number" && (
              <ScoreCard label="Body Language & Presence" score={scores.bodyLanguage} />
            )}
          </div>
        </section>
      )}

      {bigFixes && bigFixes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Big 3 fixes to prioritize</h3>
          </div>
          <div className="space-y-2">
            {bigFixes.slice(0, 3).map((fix, idx) => (
              <div key={idx} className="rounded-lg border border-neutral-800 bg-[#050509] px-3.5 py-3 flex gap-3 items-start">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-black shadow-md leading-none">
                  {idx + 1}
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-neutral-100">{fix.what}</p>
                  <p className="text-[11px] text-neutral-400">{fix.why}</p>
                  {fix.example && (
                    <p className="text-[11px] text-neutral-300">
                      <span className="font-semibold text-neutral-200">Example:&nbsp;</span>{fix.example}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {lineSuggestions && lineSuggestions.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Line-level wording tweaks</h3>
          <div className="space-y-2 text-sm">
            {lineSuggestions.map((ls, idx) => (
              <div key={idx} className="rounded-2xl border border-neutral-800 bg-[#050509] px-4 py-3.5 space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 border border-neutral-700 text-[10px] font-semibold text-neutral-200">{idx + 1}</span>
                  <span>Micro copy improvement</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 md:gap-4 items-stretch">
                  <div className="rounded-xl bg-[#0b0f1a] border border-neutral-800 px-3 py-2.5">
                    <p className="text-[11px] font-medium text-neutral-400 mb-1">Before</p>
                    <p className="text-xs text-neutral-300 whitespace-pre-wrap">{ls.before}</p>
                  </div>
                  <div className="hidden md:flex items-center justify-center text-neutral-500">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className="rounded-xl bg-[#060e1f] border border-emerald-600/50 px-3 py-2.5">
                    <p className="text-[11px] font-medium text-emerald-400 mb-1">After</p>
                    <p className="text-xs text-neutral-100 whitespace-pre-wrap">{ls.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {judgeNotes && judgeNotes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Quote className="w-4 h-4 text-emerald-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Judge perspective</h3>
          </div>
          <div className="space-y-1.5">
            {judgeNotes.map((note, idx) => (
              <div key={idx} className="flex gap-2 rounded-lg border border-neutral-800 bg-[#050509] px-3 py-2">
                <span className="mt-[6px] h-[3px] w-[3px] rounded-full bg-neutral-400 shrink-0" />
                <span className="whitespace-pre-wrap text-neutral-100 text-xs">{note}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {practicePrompt && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Practice next</h3>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-3.5 py-3 flex items-start gap-2">
            <span className="mt-[3px] inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            <p className="text-sm text-neutral-100 whitespace-pre-wrap">{practicePrompt}</p>
          </div>
        </section>
      )}
    </div>
  );
};

export default FeedbackDisplay;
