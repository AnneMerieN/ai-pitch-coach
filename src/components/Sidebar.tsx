import React, { useState, useRef, useEffect } from "react";
import type { User } from "firebase/auth";
import type { ChatSession } from "../services/chatStorage";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  user: User | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onNewSession: () => void;
  onRename: (sessionId: string, newTitle: string) => Promise<void>;
  onPin: (sessionId: string, pinned: boolean) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
}

const formatDate = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
};

// ── Session row ───────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onPin: () => void;
  onDelete: () => void;
}

const SessionRow: React.FC<SessionRowProps> = ({
  session, isActive, onSelect, onRename, onPin, onDelete,
}) => {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Focus input when renaming starts
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== session.title) onRename(trimmed);
    setRenaming(false);
  };

  return (
    <div
      className="relative group rounded-xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); if (!menuOpen) setMenuOpen(false); }}
      style={{ background: isActive || menuOpen ? "#2a2b2d" : "transparent" }}
    >
      {renaming ? (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRename();
            if (e.key === "Escape") { setRenameValue(session.title); setRenaming(false); }
          }}
          className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
          style={{ background: "#3c4043", color: "#e3e3e3", border: "1px solid #fecc07" }}
        />
      ) : (
        <button
          onClick={onSelect}
          className="w-full text-left px-3 py-2 text-sm rounded-xl flex items-center gap-1"
          style={{ color: isActive ? "#e3e3e3" : "#9aa0a6" }}
          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#e3e3e3"; }}
          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "#9aa0a6"; }}
        >
          {session.pinned && (
            <span className="shrink-0 mr-1" style={{ color: "#fecc07" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
              </svg>
            </span>
          )}
          <span className="truncate flex-1">{session.title}</span>
        </button>
      )}

      {/* Three-dot button */}
      {!renaming && (hovered || menuOpen) && (
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-lg transition"
          style={{ color: "#9aa0a6", background: menuOpen ? "#3c4043" : "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#3c4043")}
          onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
      )}

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-8 py-1.5 z-50"
          style={{ width: 160, background: "rgba(44,45,47,0.92)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", borderRadius: "20px" }}
        >
          {[
            {
              label: "Rename",
              danger: false,
              action: () => { setMenuOpen(false); setRenaming(true); },
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              ),
            },
            {
              label: session.pinned ? "Unpin" : "Pin",
              danger: false,
              action: () => { setMenuOpen(false); onPin(); },
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
                </svg>
              ),
            },
            {
              label: "Delete",
              danger: true,
              action: () => { setMenuOpen(false); onDelete(); },
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              ),
            },
          ].map(({ label, icon, action, danger }) => (
            <button
              key={label}
              onClick={action}
              className="w-full text-left text-sm flex items-center gap-3 transition"
              style={{ color: danger ? "#f87171" : "#e3e3e3", padding: "5px 8px", borderRadius: "999px", margin: "1px 6px", width: "calc(100% - 12px)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#3c4043")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onToggle, user, sessions, activeSessionId,
  onSelectSession, onNewSession, onRename, onPin, onDelete,
}) => {
  const pinned = sessions.filter((s) => s.pinned);
  const unpinned = sessions.filter((s) => !s.pinned);

  const grouped = unpinned.reduce<Record<string, ChatSession[]>>((acc, s) => {
    const label = formatDate(s.updatedAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {});

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 240,
        marginLeft: isOpen ? 0 : -240,
        transition: "margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        willChange: "margin-left",
        background: "#1e1f20",
        borderRight: "1px solid #2a2b2d",
        borderRadius: "0 16px 16px 0",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-end px-3 py-3 shrink-0">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg transition"
          style={{ color: "#9aa0a6" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2b2d")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>

      {/* New chat */}
      <div className="px-3 mb-2 shrink-0">
        <button
          onClick={onNewSession}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-full text-sm transition"
          style={{ background: "transparent", color: "#e3e3e3" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2b2d")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "#fecc07" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#131314" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          New chat
        </button>
        <div className="mx-3 mt-2 mb-1" style={{ height: "1px", background: "#2a2b2d" }} />
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto scroll-thin px-3 py-1">
        {!user ? (
          <p className="text-xs px-3 py-2" style={{ color: "#5f6368" }}>Sign in to save your sessions</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs px-3 py-2" style={{ color: "#5f6368" }}>No sessions yet</p>
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <div className="mb-3">
                <p className="text-xs px-3 py-1 font-medium" style={{ color: "#5f6368" }}>Pinned</p>
                {pinned.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s)}
                    onRename={(t) => onRename(s.id, t)}
                    onPin={() => onPin(s.id, !s.pinned)}
                    onDelete={() => onDelete(s.id)}
                  />
                ))}
              </div>
            )}

            {/* By date */}
            {Object.entries(grouped).map(([label, group]) => (
              <div key={label} className="mb-3">
                <p className="text-xs px-3 py-1 font-medium" style={{ color: "#5f6368" }}>{label}</p>
                {group.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s)}
                    onRename={(t) => onRename(s.id, t)}
                    onPin={() => onPin(s.id, !s.pinned)}
                    onDelete={() => onDelete(s.id)}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
