import mammoth from "mammoth";

export type FileContentType = "base64-pdf" | "text";

export interface ProcessedFile {
  name: string;
  mimeType: string;
  contentType: FileContentType;
  content: string; // base64 string for PDF, plain text for others
  sizeKb: number;
}

const MAX_SIZE_MB = 10;

const readAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
  });

const readAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

const readAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
  });

export const SUPPORTED_TYPES = {
  documents: [".pdf", ".docx", ".txt"],
  audio: [".mp3", ".wav", ".m4a"],
  video: [".mp4", ".mov", ".webm"],
};

export type FileCategory = "document" | "audio" | "video" | "unsupported";

export const getFileCategory = (file: File): FileCategory => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt")) return "document";
  if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".m4a")) return "audio";
  if (name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".webm")) return "video";
  return "unsupported";
};

export const processFile = async (file: File): Promise<ProcessedFile> => {
  const sizeKb = file.size / 1024;
  const sizeMb = sizeKb / 1024;

  if (sizeMb > MAX_SIZE_MB) {
    throw new Error(`File is too large. Maximum size is ${MAX_SIZE_MB}MB.`);
  }

  const name = file.name.toLowerCase();

  // PDF → base64 for Claude's native document support
  if (name.endsWith(".pdf")) {
    const base64 = await readAsBase64(file);
    return { name: file.name, mimeType: "application/pdf", contentType: "base64-pdf", content: base64, sizeKb };
  }

  // DOCX → extract text with mammoth
  if (name.endsWith(".docx")) {
    const arrayBuffer = await readAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (!result.value.trim()) {
      throw new Error("Could not extract text from this DOCX file. Try saving it as a PDF.");
    }
    return { name: file.name, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contentType: "text", content: result.value, sizeKb };
  }

  // TXT → plain text
  if (name.endsWith(".txt")) {
    const text = await readAsText(file);
    return { name: file.name, mimeType: "text/plain", contentType: "text", content: text, sizeKb };
  }

  throw new Error("Unsupported file type.");
};
