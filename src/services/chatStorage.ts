import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Message, ConversationTurn, PitchLength } from "../types";

export interface ChatSession {
  id: string;
  title: string;
  pitchLength: PitchLength;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  history: ConversationTurn[];
  pinned?: boolean;
}

// Create a new session in Firestore, returns the session ID
export const createSession = async (
  userId: string,
  firstMessage: string,
  pitchLength: PitchLength
): Promise<string> => {
  const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "…" : "");
  const ref = await addDoc(collection(db, "users", userId, "sessions"), {
    title,
    pitchLength,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    messages: [],
    history: [],
  });
  return ref.id;
};

// Save updated messages + history to an existing session
export const saveSession = async (
  userId: string,
  sessionId: string,
  messages: Message[],
  history: ConversationTurn[]
): Promise<void> => {
  const ref = doc(db, "users", userId, "sessions", sessionId);
  await updateDoc(ref, {
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      feedback: m.feedback ?? null,
      isLoading: false,
    })),
    history,
    updatedAt: serverTimestamp(),
  });
};

export const renameSession = async (userId: string, sessionId: string, newTitle: string): Promise<void> => {
  await updateDoc(doc(db, "users", userId, "sessions", sessionId), { title: newTitle });
};

export const pinSession = async (userId: string, sessionId: string, pinned: boolean): Promise<void> => {
  await updateDoc(doc(db, "users", userId, "sessions", sessionId), { pinned });
};

export const deleteSession = async (userId: string, sessionId: string): Promise<void> => {
  await deleteDoc(doc(db, "users", userId, "sessions", sessionId));
};

// Load all sessions for a user, sorted newest first
export const loadSessions = async (userId: string): Promise<ChatSession[]> => {
  const q = query(
    collection(db, "users", userId, "sessions"),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      pitchLength: data.pitchLength,
      createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
      updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
      messages: data.messages ?? [],
      history: data.history ?? [],
      pinned: data.pinned ?? false,
    };
  });
};
