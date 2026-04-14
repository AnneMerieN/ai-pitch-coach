import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, googleProvider } from "./services/firebase";
import { loadSessions, renameSession, pinSession, deleteSession } from "./services/chatStorage";
import type { ChatSession } from "./services/chatStorage";
import Sidebar from "./components/Sidebar";
import MainArea from "./components/MainArea";

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem("sidebarOpen");
    return stored !== null ? stored === "true" : true;
  });
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);

  const toggleSidebar = (value?: boolean) => {
    setSidebarOpen((prev) => {
      const next = value !== undefined ? value : !prev;
      localStorage.setItem("sidebarOpen", String(next));
      return next;
    });
  };

  const setActiveSessionWithPersist = (session: ChatSession | null) => {
    setActiveSession(session);
    if (session) {
      localStorage.setItem("lastSessionId", session.id);
    } else {
      localStorage.removeItem("lastSessionId");
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        const loaded = await loadSessions(u.uid);
        setSessions(loaded);
        const lastId = localStorage.getItem("lastSessionId");
        if (lastId) {
          const found = loaded.find((s) => s.id === lastId);
          if (found) setActiveSession(found);
        }
      } else {
        setSessions([]);
        setActiveSession(null);
        localStorage.removeItem("lastSessionId");
      }
    });
    return unsub;
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Sign-in error:", err);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    toggleSidebar(false);
  };

  const refreshSessions = async () => {
    if (!user) return [];
    const loaded = await loadSessions(user.uid);
    setSessions(loaded);
    return loaded;
  };

  const handleSelectSession = (session: ChatSession) => {
    setActiveSessionWithPersist(session);
  };

  const handleNewSession = () => {
    setActiveSessionWithPersist(null);
  };

  const handleRename = async (sessionId: string, newTitle: string) => {
    if (!user) return;
    await renameSession(user.uid, sessionId, newTitle);
    await refreshSessions();
  };

  const handlePin = async (sessionId: string, pinned: boolean) => {
    if (!user) return;
    await pinSession(user.uid, sessionId, pinned);
    await refreshSessions();
  };

  const handleDelete = async (sessionId: string) => {
    if (!user) return;
    await deleteSession(user.uid, sessionId);
    if (activeSession?.id === sessionId) setActiveSessionWithPersist(null);
    await refreshSessions();
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#131314" }}>
        <div className="w-6 h-6 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#131314" }}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => toggleSidebar()}
        user={user}
        sessions={sessions}
        activeSessionId={activeSession?.id ?? null}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onRename={handleRename}
        onPin={handlePin}
        onDelete={handleDelete}
      />
      <MainArea
        onMenuClick={() => toggleSidebar()}
        sidebarOpen={sidebarOpen}
        onNewSession={handleNewSession}
        user={user}
        activeSession={activeSession}
        onSessionCreated={(id) => {
          refreshSessions().then((loaded) => {
            const found = loaded?.find((s) => s.id === id);
            if (found) setActiveSessionWithPersist(found);
          });
        }}
        onSessionUpdated={refreshSessions}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        key={activeSession?.id ?? "new"}
      />
    </div>
  );
};

export default App;
