import React, { useState, useRef, useEffect, useCallback } from "react";

type RecordingState = "idle" | "recording" | "stopped";

interface Props {
  onSend: (transcript: string) => void;
  isLoading: boolean;
}

const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const AudioRecorder: React.FC<Props> = ({ onSend, isLoading }) => {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [editableTranscript, setEditableTranscript] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs so callbacks always see current values
  const finalTranscriptRef = useRef("");
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<number>(0);
  const isRecordingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep ref in sync with state
  useEffect(() => {
    finalTranscriptRef.current = finalTranscript;
  }, [finalTranscript]);

  // Waveform draw loop
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = bufferLength;
      const barWidth = canvas.width / barCount - 1;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] / 255;
        const barHeight = value * canvas.height;
        const alpha = 0.3 + value * 0.7;
        ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
        const x = i * (barWidth + 1);
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      }
    };

    draw();
  }, []);

  const cleanup = useCallback(() => {
    isRecordingRef.current = false;

    recognitionRef.current?.stop();
    recognitionRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;

    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);

    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  const stopRecording = useCallback(() => {
    cleanup();
    setEditableTranscript(finalTranscriptRef.current.trim());
    setInterimTranscript("");
    setRecordingState("stopped");
  }, [cleanup]);

  const startRecording = async () => {
    setError(null);
    setFinalTranscript("");
    setInterimTranscript("");
    setEditableTranscript("");
    setSeconds(0);
    finalTranscriptRef.current = "";

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      setError(
        "Speech recognition isn't supported in your browser. Please use Chrome or Edge."
      );
      return;
    }

    try {
      // Microphone stream for visualizer
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio context + analyser
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;
      audioCtx.createMediaStreamSource(stream).connect(analyser);

      // Speech recognition
      const recognition: any = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;
      isRecordingRef.current = true;

      recognition.onresult = (e: any) => {
        let newFinal = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) newFinal += t + " ";
          else interim += t;
        }
        if (newFinal) {
          setFinalTranscript((prev) => {
            const updated = prev + newFinal;
            finalTranscriptRef.current = updated;
            return updated;
          });
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech" && e.error !== "aborted") {
          setError(`Microphone error: ${e.error}. Try refreshing and allowing mic access.`);
          stopRecording();
        }
      };

      // Auto-restart on silence (browser behaviour)
      recognition.onend = () => {
        if (isRecordingRef.current && recognitionRef.current === recognition) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.start();
      setRecordingState("recording");

      // Timer
      timerRef.current = window.setInterval(
        () => setSeconds((s) => s + 1),
        1000
      );

      drawWaveform();
    } catch {
      setError(
        "Could not access your microphone. Please allow mic permissions and try again."
      );
    }
  };

  const handleSend = () => {
    const text = editableTranscript.trim();
    if (!text || isLoading) return;
    onSend(text);
    setRecordingState("idle");
    setEditableTranscript("");
    setFinalTranscript("");
    setSeconds(0);
  };

  const handleReset = () => {
    setRecordingState("idle");
    setFinalTranscript("");
    setInterimTranscript("");
    setEditableTranscript("");
    setSeconds(0);
    setError(null);
  };

  return (
    <div className="space-y-3">

      {/* Idle: single row prompt */}
      {recordingState === "idle" && (
        <div className="flex items-center h-10">
          {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
          <button
            onClick={startRecording}
            disabled={isLoading}
            className="flex items-center gap-2 transition disabled:opacity-40"
            style={{ background: "transparent", color: "#9aa0a6", border: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#e3e3e3"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#9aa0a6"; }}
          >
            <span className="flex items-center justify-center shrink-0" style={{ width: 16, height: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </span>
            <span className="text-sm leading-none">Start recording…</span>
          </button>
        </div>
      )}

      {/* Waveform */}
      <div
        className={`transition-all duration-300 overflow-hidden ${
          recordingState === "recording" ? "h-16 opacity-100" : "h-0 opacity-0"
        }`}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={64}
          className="w-full h-16 rounded-xl"
          style={{ background: "#2a2b2d" }}
        />
      </div>

      {/* Live transcript while recording */}
      {recordingState === "recording" && (
        <div className="rounded-xl px-4 py-3 min-h-[56px]" style={{ background: "#2a2b2d" }}>
          <p className="text-sm leading-relaxed" style={{ color: "#e3e3e3" }}>
            {finalTranscript}
            <span className="italic" style={{ color: "#5f6368" }}>{interimTranscript}</span>
            {!finalTranscript && !interimTranscript && (
              <span style={{ color: "#5f6368" }}>Listening…</span>
            )}
          </p>
        </div>
      )}

      {/* Editable transcript after stopping */}
      {recordingState === "stopped" && (
        <div className="space-y-1.5">
          <p className="text-xs" style={{ color: "#5f6368" }}>Review and edit before sending:</p>
          <textarea
            value={editableTranscript}
            onChange={(e) => setEditableTranscript(e.target.value)}
            rows={5}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
            style={{ background: "#2a2b2d", color: "#e3e3e3", border: "1px solid #3c4043" }}
            placeholder="Your transcript will appear here…"
          />
        </div>
      )}

      {recordingState !== "idle" && error && (
        <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
      )}

      {/* Controls — recording / stopped */}
      {recordingState === "recording" && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums" style={{ color: "#9aa0a6" }}>
            {formatTime(seconds)}
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "#fecc07" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#fecc07" }} />
            Recording
          </span>
          <button
            onClick={stopRecording}
            className="ml-auto flex items-center justify-center transition"
            style={{ background: "none", border: "none" }}
            title="Stop"
          >
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="17" stroke="#ef4444" strokeWidth="1.8"/>
              <rect x="11" y="11" width="14" height="14" rx="3" fill="#ef4444"/>
            </svg>
          </button>
        </div>
      )}

      {recordingState === "stopped" && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="text-sm transition text-[#9aa0a6] hover:text-[#e3e3e3]"
            style={{ background: "none", border: "none" }}
          >
            Re-record
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !editableTranscript.trim()}
            className="ml-auto w-9 h-9 rounded-full flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#fecc07", color: "#131314" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
