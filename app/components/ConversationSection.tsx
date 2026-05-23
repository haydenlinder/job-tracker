"use client";

import { useState } from "react";
import JobEmailCard from "./JobEmailCard";
import { JobEmail } from "@/lib/types";

interface ConversationGroup {
  threadId: string;
  emails: JobEmail[];
  subject: string;
}

interface ConversationSectionProps {
  conversations: ConversationGroup[];
  defaultOpen?: boolean;
}

export default function ConversationSection({
  conversations,
  defaultOpen = false,
}: ConversationSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  if (conversations.length === 0) {
    return null;
  }

  const toggleThread = (threadId: string) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId);
    } else {
      newExpanded.add(threadId);
    }
    setExpandedThreads(newExpanded);
  };

  const totalEmails = conversations.reduce((acc, conv) => acc + conv.emails.length, 0);

  return (
    <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 border-b transition-colors hover:opacity-90 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">💬</span>
          <span className="font-semibold text-amber-800 dark:text-amber-200">
            Conversations
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
            {conversations.length} threads • {totalEmails} emails
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-amber-800 dark:text-amber-200 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="p-4 bg-white dark:bg-zinc-900 space-y-3">
          {conversations.map((conversation) => (
            <div
              key={conversation.threadId}
              className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden"
            >
              <button
                onClick={() => toggleThread(conversation.threadId)}
                className="w-full flex items-center justify-between p-3 bg-amber-50/50 dark:bg-amber-900/20 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-amber-600 dark:text-amber-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {conversation.subject || "(No subject)"}
                  </span>
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                    {conversation.emails.length} emails
                  </span>
                </div>
                <svg
                  className={`flex-shrink-0 w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform duration-200 ml-2 ${
                    expandedThreads.has(conversation.threadId) ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {expandedThreads.has(conversation.threadId) && (
                <div className="p-3 space-y-2 bg-white dark:bg-zinc-900 border-t border-amber-200 dark:border-amber-800">
                  {conversation.emails.map((email) => (
                    <JobEmailCard key={email.id} email={email} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { ConversationGroup };
