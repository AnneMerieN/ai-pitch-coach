import React, { useEffect, useRef } from "react";
import { ChatMessage } from "../types";
import { UserIcon, CoachIcon } from "./Icons";
import FeedbackDisplay from "./FeedbackDisplay";
import LoadingSpinner from "./LoadingSpinner";

interface ChatHistoryProps {
  messages: ChatMessage[];
  isWelcomeOnly?: boolean;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ messages, isWelcomeOnly }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const computedWelcomeOnly = isWelcomeOnly ?? (messages.length === 1 && messages[0].role === "system");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={computedWelcomeOnly ? "flex justify-center" : "flex-1 overflow-y-auto"}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {messages.map((msg) => {
          if (msg.role === "system") return null;

          const isUser = msg.role === "user";
          const isAssistant = msg.role === "assistant";

          return (
            <div key={msg.id} className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className="flex gap-3 max-w-[95%]">
                {isAssistant && <div className="mt-1 shrink-0"><CoachIcon /></div>}
                <div className="flex-1">
                  {isUser && (
                    <div className="rounded-lg bg-[#343541] px-4 py-3 text-sm leading-relaxed">
                      {typeof msg.content === "string" ? (
                        <p className="whitespace-pre-wrap text-neutral-100">{msg.content}</p>
                      ) : (
                        <p className="text-neutral-100">Uploaded file: <strong>{msg.content.name}</strong></p>
                      )}
                    </div>
                  )}
                  {isAssistant && (
                    <div className="text-sm leading-relaxed">
                      {typeof msg.content === "string" && msg.content.trim().length > 0 && (
                        <p className="mb-3 text-neutral-100 whitespace-pre-wrap">{msg.content}</p>
                      )}
                      {msg.isLoading && <div className="mt-1"><LoadingSpinner /></div>}
                      {msg.feedback && <div className="mt-2"><FeedbackDisplay feedback={msg.feedback} /></div>}
                    </div>
                  )}
                </div>
                {isUser && <div className="mt-1 shrink-0"><UserIcon /></div>}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default ChatHistory;
