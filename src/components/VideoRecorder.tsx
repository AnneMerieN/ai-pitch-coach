import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveMetrics {
  eyeContact: boolean;
  goodPosture: boolean;
  smiling: boolean;
  stable: boolean;
}

interface StatsAcc {
  eyeContact: number;
  goodPosture: number;
  smiling: number;
  stable: number;
  total: number;
}

export interface BodyLanguageSummary {
  eyeContactPct: number;
  goodPosturePct: number;
  smilingPct: number;
  stablePct: number;
}

export interface VideoReviewData {
  transcript: string;
  snapshot: string;         // base64 JPEG
  stats: BodyLanguageSummary;
}

interface Props {
  onSend: (data: VideoReviewData) => void;
  isLoading: boolean;
  pitchLength: "60s" | "3min" | "10min";
  onRecordingChange?: (recording: boolean) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PITCH_LIMIT: Record<string, number> = { "60s": 60, "3min": 180, "10min": 600 };
const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const pct = (acc: StatsAcc, key: keyof Omit<StatsAcc, "total">) =>
  acc.total === 0 ? 0 : Math.round((acc[key] / acc.total) * 100);

const getLiveTip = (m: LiveMetrics): string | null => {
  if (!m.eyeContact) return "Look directly at the camera — judges want eye contact";
  if (!m.goodPosture) return "Sit up straight — good posture signals confidence";
  if (!m.smiling) return "Relax and show enthusiasm — let your energy come through";
  if (!m.stable) return "Reduce movement — stay composed and still";
  return null;
};

const captureSnapshot = (video: HTMLVideoElement): string => {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
};

// ── Indicator badge ───────────────────────────────────────────────────────────

const Indicator: React.FC<{ label: string; ok: boolean }> = ({ label, ok }) => (
  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
    ok ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
    {label}
  </div>
);

// ── Stat bar ──────────────────────────────────────────────────────────────────

const StatBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const color = value >= 70 ? "bg-emerald-400" : value >= 40 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-400 w-40 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-neutral-300 w-8 text-right">{value}%</span>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

type State = "idle" | "loading" | "recording" | "stopped";

const VideoRecorder: React.FC<Props> = ({ onSend, isLoading, pitchLength, onRecordingChange }) => {
  const limitSeconds = PITCH_LIMIT[pitchLength];

  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>({
    eyeContact: true, goodPosture: true, smiling: true, stable: true,
  });
  const [liveTip, setLiveTip] = useState<string | null>(null);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [reviewData, setReviewData] = useState<VideoReviewData | null>(null);
  const [editableTranscript, setEditableTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Initializing camera…");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<number>(0);
  const statsRef = useRef<StatsAcc>({ eyeContact: 0, goodPosture: 0, smiling: 0, stable: 0, total: 0 });
  const prevLandmarksRef = useRef<{ x: number; y: number; z: number }[] | null>(null);
  const finalTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);
  const tipTimerRef = useRef<number>(0);
  const secondsRef = useRef(0);

  useEffect(() => { finalTranscriptRef.current = finalTranscript; }, [finalTranscript]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { onRecordingChange?.(state === "recording" || state === "loading"); }, [state, onRecordingChange]);

  const cleanup = useCallback(() => {
    isRecordingRef.current = false;

    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);
    clearInterval(tipTimerRef.current);

    recognitionRef.current?.stop();
    recognitionRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    faceLandmarkerRef.current?.close();
    faceLandmarkerRef.current = null;
    poseLandmarkerRef.current?.close();
    poseLandmarkerRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── MediaPipe analysis loop ─────────────────────────────────────────────────

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !isRecordingRef.current) {
      animFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const ts = performance.now();
    let eyeContact = false;
    let smiling = false;
    let goodPosture = false;
    let stable = true;

    // ── Face ──────────────────────────────────────────────────────────────────
    if (faceLandmarkerRef.current) {
      try {
        const face = faceLandmarkerRef.current.detectForVideo(video, ts);

        if (face.facialTransformationMatrixes?.length) {
          const m = face.facialTransformationMatrixes[0].data;
          const yaw = Math.atan2(m[8], m[10]) * (180 / Math.PI);
          const pitch = Math.atan2(-m[9], Math.sqrt(m[8] ** 2 + m[10] ** 2)) * (180 / Math.PI);
          eyeContact = Math.abs(yaw) < 20 && Math.abs(pitch) < 20;
        }

        if (face.faceBlendshapes?.length) {
          const bs = face.faceBlendshapes[0].categories;
          const sl = bs.find((b) => b.categoryName === "mouthSmileLeft")?.score ?? 0;
          const sr = bs.find((b) => b.categoryName === "mouthSmileRight")?.score ?? 0;
          smiling = (sl + sr) / 2 > 0.2;
        }
      } catch {}
    }

    // ── Pose ──────────────────────────────────────────────────────────────────
    if (poseLandmarkerRef.current) {
      try {
        const pose = poseLandmarkerRef.current.detectForVideo(video, ts);

        if (pose.landmarks?.length) {
          const lm = pose.landmarks[0];
          const lShoulder = lm[11];
          const rShoulder = lm[12];
          const nose = lm[0];

          const shouldersLevel = Math.abs(lShoulder.y - rShoulder.y) < 0.06;
          const midY = (lShoulder.y + rShoulder.y) / 2;
          const headUp = nose.y < midY - 0.04;
          goodPosture = shouldersLevel && headUp;

          if (prevLandmarksRef.current) {
            const movement =
              lm.reduce((sum, p, i) => {
                const prev = prevLandmarksRef.current![i];
                return sum + Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
              }, 0) / lm.length;
            stable = movement < 0.012;
          }
          prevLandmarksRef.current = lm;
        }
      } catch {}
    }

    const metrics: LiveMetrics = { eyeContact, goodPosture, smiling, stable };
    setLiveMetrics(metrics);

    const s = statsRef.current;
    s.total++;
    if (eyeContact) s.eyeContact++;
    if (goodPosture) s.goodPosture++;
    if (smiling) s.smiling++;
    if (stable) s.stable++;

    animFrameRef.current = requestAnimationFrame(analyzeFrame);
  }, []);

  // ── Stop recording ──────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    const snapshot = videoRef.current ? captureSnapshot(videoRef.current) : "";
    const transcript = finalTranscriptRef.current.trim();
    const s = statsRef.current;

    const stats: BodyLanguageSummary = {
      eyeContactPct: pct(s, "eyeContact"),
      goodPosturePct: pct(s, "goodPosture"),
      smilingPct: pct(s, "smiling"),
      stablePct: pct(s, "stable"),
    };

    cleanup();
    setEditableTranscript(transcript);
    setReviewData({ transcript, snapshot, stats });
    setState("stopped");
  }, [cleanup]);

  // ── Start recording ─────────────────────────────────────────────────────────

  const startRecording = async () => {
    setError(null);
    setFinalTranscript("");
    setInterimTranscript("");
    setEditableTranscript("");
    setSeconds(0);
    secondsRef.current = 0;
    statsRef.current = { eyeContact: 0, goodPosture: 0, smiling: 0, stable: 0, total: 0 };
    prevLandmarksRef.current = null;
    finalTranscriptRef.current = "";
    setState("loading");

    try {
      // ── Camera ──────────────────────────────────────────────────────────────
      setLoadingMsg("Starting camera & microphone…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((res) => {
          videoRef.current!.onloadedmetadata = () => res();
        });
        videoRef.current.play();
      }

      // ── MediaPipe ───────────────────────────────────────────────────────────
      setLoadingMsg("Loading AI models…");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );

      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });

      poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      // ── Speech recognition ──────────────────────────────────────────────────
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const recognition: SpeechRecognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognitionRef.current = recognition;
        isRecordingRef.current = true;

        recognition.onresult = (e: SpeechRecognitionEvent) => {
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

        recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
          if (e.error !== "no-speech" && e.error !== "aborted") {
            setError(`Microphone error: ${e.error}. Check that mic permissions are allowed.`);
          }
        };

        recognition.onend = () => {
          if (isRecordingRef.current && recognitionRef.current === recognition) {
            try { recognition.start(); } catch {}
          }
        };

        recognition.start();
      }

      // ── Timer ───────────────────────────────────────────────────────────────
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= limitSeconds) {
            stopRecording();
          }
          return next;
        });
      }, 1000);

      // ── Tip rotation ────────────────────────────────────────────────────────
      tipTimerRef.current = window.setInterval(() => {
        setLiveMetrics((m) => {
          setLiveTip(getLiveTip(m));
          return m;
        });
      }, 5000);

      // ── Analysis loop ────────────────────────────────────────────────────────
      animFrameRef.current = requestAnimationFrame(analyzeFrame);

      setState("recording");
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera and microphone permissions."
          : "Could not start recording. Please check your camera is connected."
      );
      cleanup();
      setState("idle");
    }
  };

  // ── Send ────────────────────────────────────────────────────────────────────

  const handleSend = () => {
    if (!reviewData || isLoading) return;
    onSend({ ...reviewData, transcript: editableTranscript.trim() });
    setState("idle");
    setReviewData(null);
    setSeconds(0);
  };

  const handleReset = () => {
    setReviewData(null);
    setFinalTranscript("");
    setInterimTranscript("");
    setEditableTranscript("");
    setSeconds(0);
    setState("idle");
    setError(null);
  };

  const timeLeft = limitSeconds - seconds;
  const showWarning = state === "recording" && timeLeft <= 30;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* Idle: single row prompt */}
      {state === "idle" && (
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
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
            </span>
            <span className="text-sm leading-none">Start recording…</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {state === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 py-6 rounded-xl" style={{ background: "#2a2b2d" }}>
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "#3c4043", borderTopColor: "#e3e3e3" }} />
          <p className="text-sm" style={{ color: "#9aa0a6" }}>{loadingMsg}</p>
        </div>
      )}

      {/* Video element — always mounted so we can attach stream */}
      <div className={`relative rounded-xl overflow-hidden ${state === "recording" ? "block" : "hidden"}`} style={{ background: "#2a2b2d" }}>
        <video
          ref={videoRef}
          className="w-full aspect-video object-cover"
          style={{ transform: "scaleX(-1)" }}
          muted
          playsInline
          controls={false}
        />
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <Indicator label="Eye contact" ok={liveMetrics.eyeContact} />
          <Indicator label="Posture" ok={liveMetrics.goodPosture} />
          <Indicator label="Expression" ok={liveMetrics.smiling} />
          <Indicator label="Composure" ok={liveMetrics.stable} />
        </div>
        <div className="absolute top-3 left-3">
          <span className={`text-xs font-mono font-medium px-2.5 py-1 rounded-full ${
            showWarning
              ? "text-yellow-300"
              : "text-white"
          }`} style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
            {formatTime(seconds)} / {formatTime(limitSeconds)}
          </span>
        </div>
        {showWarning && (
          <div className="absolute bottom-12 left-0 right-0 flex justify-center">
            <div className="text-xs font-medium px-4 py-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", color: "#fde047" }}>
              {timeLeft}s remaining — start wrapping up
            </div>
          </div>
        )}
        {liveTip && !showWarning && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="bg-black/70 text-white text-xs px-3 py-2 rounded-lg">
              {liveTip}
            </div>
          </div>
        )}
      </div>

      {/* Live transcript while recording */}
      {state === "recording" && (
        <div className="rounded-xl px-4 py-3 min-h-[48px]" style={{ background: "#2a2b2d" }}>
          <p className="text-xs mb-1" style={{ color: "#5f6368" }}>Live transcript</p>
          <p className="text-sm leading-relaxed" style={{ color: "#e3e3e3" }}>
            {finalTranscript}
            <span className="italic" style={{ color: "#5f6368" }}>{interimTranscript}</span>
            {!finalTranscript && !interimTranscript && (
              <span style={{ color: "#5f6368" }}>Listening…</span>
            )}
          </p>
        </div>
      )}

      {/* Review screen */}
      {state === "stopped" && reviewData && (
        <div className="space-y-4">
          <div className="flex gap-4">
            {reviewData.snapshot && (
              <div className="shrink-0">
                <img
                  src={`data:image/jpeg;base64,${reviewData.snapshot}`}
                  alt="Snapshot"
                  className="w-40 h-28 object-cover rounded-xl"
                  style={{ transform: "scaleX(-1)" }}
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#5f6368" }}>Body Language</p>
              <StatBar label="Eye contact" value={reviewData.stats.eyeContactPct} />
              <StatBar label="Good posture" value={reviewData.stats.goodPosturePct} />
              <StatBar label="Confident expression" value={reviewData.stats.smilingPct} />
              <StatBar label="Composed / still" value={reviewData.stats.stablePct} />
            </div>
          </div>
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
        </div>
      )}

      {state !== "idle" && error && (
        <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
      )}

      {/* Controls — recording / stopped */}
      {state === "recording" && (
        <div className="flex items-center gap-3">
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

      {state === "stopped" && (
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

export default VideoRecorder;
