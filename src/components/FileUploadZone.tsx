import React, { useRef, useState } from "react";
import { processFile, getFileCategory } from "../utils/fileProcessor";
import type { ProcessedFile } from "../utils/fileProcessor";

interface Props {
  onFileReady: (file: ProcessedFile | null) => void;
  currentFile: ProcessedFile | null;
}

const FileIcon: React.FC<{ name: string }> = ({ name }) => {
  const ext = name.split(".").pop()?.toLowerCase();
  const colors: Record<string, string> = {
    pdf: "text-red-400",
    docx: "text-blue-400",
    txt: "text-neutral-400",
  };
  return (
    <span className={`text-xs font-bold uppercase ${colors[ext ?? ""] ?? "text-neutral-400"}`}>
      {ext}
    </span>
  );
};

const formatSize = (kb: number) =>
  kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;

const FileUploadZone: React.FC<Props> = ({ onFileReady, currentFile }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    const category = getFileCategory(file);

    if (category === "audio" || category === "video") {
      setError(
        `Audio and video files can't be analyzed here — use the ${category === "audio" ? "Audio" : "Video"} tab to record your pitch directly.`
      );
      return;
    }

    if (category === "unsupported") {
      setError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
      return;
    }

    setIsProcessing(true);
    try {
      const processed = await processFile(file);
      onFileReady(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  // File attached state
  if (currentFile) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl">
        <div className="w-8 h-8 rounded-lg bg-neutral-700 flex items-center justify-center shrink-0">
          <FileIcon name={currentFile.name} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-neutral-200 truncate">{currentFile.name}</p>
          <p className="text-xs text-neutral-500">{formatSize(currentFile.sizeKb)}</p>
        </div>
        <button
          onClick={() => onFileReady(null)}
          className="text-neutral-500 hover:text-neutral-200 transition text-lg leading-none"
          title="Remove file"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="flex items-center gap-2 h-10 cursor-pointer transition"
        style={{
          background: isDragging ? "rgba(255,255,255,0.04)" : undefined,
        }}
      >
        {isProcessing ? (
          <p className="text-sm animate-pulse" style={{ color: "#9aa0a6" }}>Processing file…</p>
        ) : (
          <>
            <span className="flex items-center justify-center shrink-0" style={{ width: 16, height: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isHovering ? "#e3e3e3" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="12" x2="12" y2="18"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </span>
            <span className="text-sm leading-none transition" style={{ color: isHovering ? "#e3e3e3" : "#9aa0a6" }}>Browse files or drag & drop…</span>
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
};

export default FileUploadZone;
