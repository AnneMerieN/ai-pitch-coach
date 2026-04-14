import React from "react";
import { Plus, MessageSquare, Sparkles, ChevronsLeft, ChevronsRight } from "lucide-react";

interface ConversationSidebarProps {
  sessions: { id: string; title: string; createdAt: number }[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  sessions, activeSessionId, onSelectSession, onNewSession, collapsed, onToggleCollapse,
}) => {
  return (
    <aside className={`hidden sm:flex h-screen flex-col bg-neutral-800 border-r border-neutral-900/80 text-neutral-100 transition-all duration-200 ${collapsed ? "w-20" : "w-64"}`}>
      <div className={`${collapsed ? "px-4" : "px-3"} pt-3 pb-2 border-b border-neutral-900/80`}>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold tracking-wide">AI Pitch Coach</span>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wide">Stella Zhang NVC</span>
              </div>
            )}
          </div>
          <button type="button" onClick={onToggleCollapse} className="p-1 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-neutral-100 transition-colors">
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={onNewSession}
          className={`mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-100 text-neutral-900 text-xs font-medium py-2 px-3 hover:bg-white transition-colors`}
        >
          <Plus className="w-3.5 h-3.5" />
          {!collapsed && <span>New pitch</span>}
        </button>
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto ${collapsed ? "px-3" : "px-2"} py-2 space-y-1`}>
        {!collapsed && (
          <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-neutral-500">Recent pitches</p>
        )}
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const title = session.title?.trim() || "Untitled pitch";
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelectSession(session.id)}
              title={collapsed ? title : undefined}
              className={`group w-full rounded-xl text-xs flex items-center transition-colors ${collapsed ? "justify-center px-2 py-2" : "justify-start px-2.5 py-2 gap-2"} ${isActive ? "bg-white/10 text-neutral-50 border border-white/10" : "text-neutral-300 hover:bg-white/10"}`}
            >
              <div className={`shrink-0 h-6 w-6 rounded-lg flex items-center justify-center border transition-colors ${isActive ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-neutral-700 bg-neutral-900 text-neutral-300 group-hover:bg-neutral-800"}`}>
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              {!collapsed && <p className="truncate flex-1 min-w-0">{title}</p>}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default ConversationSidebar;
