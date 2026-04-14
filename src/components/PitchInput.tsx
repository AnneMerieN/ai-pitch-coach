import React, { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Plus, Mic, Upload, X, Camera, Send, ChevronDown } from "lucide-react";
import { PitchType, PitchLength } from "../types";

interface PitchInputProps {
  onSubmit: (content: string | File, pitchType: PitchType) => void;
  isLoading: boolean;
  onOpenVideoRecorder: () => void;
  pitchLength: PitchLength;
  onPitchLengthChange: (length: PitchLength) => void;
}

const pitchLengthLabel = (length: PitchLength): string => {
  if (length === "60s") return "60 sec";
  if (length === "3min") return "3 min";
  return "10 min";
};

const modes: { id: PitchLength; label: string }[] = [
  { id: "60s", label: "60 sec" },
  { id: "3min", label: "3 min" },
  { id: "10min", label: "10 min" },
];

const PitchInput: React.FC<PitchInputProps> = ({
  onSubmit, isLoading, onOpenVideoRecorder, pitchLength, onPitchLengthChange,
}) => {
  const [input, setInput] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = el.scrollHeight + "px";
  };

  useEffect(() => { resizeTextarea(); }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleSendText = () => {
    if (isLoading) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed, "text");
    setInput("");
  };

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let type: PitchType = "text";
    if (file.type.startsWith("audio/")) type = "audio";
    else if (file.type.startsWith("video/")) type = "video";
    onSubmit(file, type);
    setShowUploadModal(false);
    e.target.value = "";
  };

  return (
    <>
      <div className="w-full flex justify-center">
        <div className="w-full max-w-3xl">
          <div className="rounded-[28px] bg-neutral-800 border border-white/10 px-5 py-4 transition-colors">
            <div className="flex items-start gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your pitch here..."
                className="flex-1 bg-transparent text-sm text-white/90 placeholder-white/50 outline-none resize-none max-h-40 min-h-[44px]"
                disabled={isLoading}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setShowUploadModal(true)} disabled={isLoading} className="text-white/60 hover:text-white transition-colors p-2 -ml-2">
                <Plus className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button type="button" onClick={() => setIsModeMenuOpen((o) => !o)} disabled={isLoading} className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 border border-white/10 transition">
                    <span>{pitchLengthLabel(pitchLength)}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {isModeMenuOpen && (
                    <div className="absolute right-0 bottom-full mb-2 w-28 rounded-xl shadow-xl z-20 overflow-hidden bg-[#0b0b10] border border-white/10">
                      {modes.map((m) => (
                        <button key={m.id} type="button" onClick={() => { onPitchLengthChange(m.id); setIsModeMenuOpen(false); }} className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${pitchLength === m.id ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button" onClick={onOpenVideoRecorder} disabled={isLoading} className="text-white/60 hover:text-white transition-colors p-2" title="Record a video pitch">
                  <Camera className="w-5 h-5" />
                </button>

                <button type="button" onClick={handleSendText} disabled={isLoading || input.trim().length === 0}
                  className={`rounded-full p-2.5 transition-all ${isLoading || input.trim().length === 0 ? "bg-emerald-500/15 text-emerald-200/40 border border-emerald-500/15 cursor-not-allowed" : "bg-emerald-500 text-black border border-emerald-300/30 hover:bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.18)]"}`}
                  title="Send text pitch"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-40">
          <div className="relative bg-[#050509] border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-neutral-400" />
                <h2 className="text-sm font-medium text-neutral-100">Upload files</h2>
              </div>
              <button type="button" onClick={() => setShowUploadModal(false)} className="text-neutral-400 hover:text-neutral-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 border-2 border-dashed border-neutral-700 rounded-xl p-8 text-center hover:border-neutral-500 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
              <p className="text-sm text-neutral-200 mb-1">Drag and drop files here</p>
              <p className="text-xs text-neutral-500">or click to select from your computer</p>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-100 transition-colors">Cancel</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-medium text-black transition-colors">Choose file</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PitchInput;
