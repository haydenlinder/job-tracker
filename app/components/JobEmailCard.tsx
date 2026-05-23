"use client";

import { CATEGORIES, JobEmail } from "@/lib/types";
import CategoryDropdown from "./CategoryDropdown";

interface JobEmailCardProps {
  email: JobEmail;
  displayCategory?: CATEGORIES;
  onCategoryChange?: (emailId: string, category: CATEGORIES) => void;
}

type styles = {
    bg: string,
    border: string,
    badge: string,
    label: string,
}

const categoryStyles: Record<CATEGORIES, styles> = {
  application: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    label: "Application",
  },
  interview: {
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    label: "Interview",
  },
  offer: {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    label: "Offer",
  },
  rejection: {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    label: "Not for me",
  },
  other: {
    bg: "bg-zinc-50 dark:bg-zinc-900/20",
    border: "border-zinc-200 dark:border-zinc-700",
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    label: "Other",
  },
  opportunity: {
    bg: "bg-zinc-50 dark:bg-zinc-900/20",
    border: "border-zinc-200 dark:border-zinc-700",
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    label: "Opportunities",
  },
  conversation: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    label: "Conversation",
  },
};

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export default function JobEmailCard({ email, displayCategory, onCategoryChange }: JobEmailCardProps) {
  const effectiveCategory = displayCategory ?? email.category;
  const style = categoryStyles[effectiveCategory];

  return (
    <div
      className={`rounded-lg border ${style.border} ${style.bg} p-4 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}
            >
              {style.label}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatDate(email.date)}
            </span>
          </div>
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate mb-1">
            {email.subject || "(No subject)"}
          </h3>
          <a target="_blank" rel="noopener noreferrer" href={`https://mail.google.com/mail/u/0/#all/${email.id}`} className="text-sm underline cursor-pointer text-zinc-900 dark:text-zinc-100 truncate mb-1">
            View Message ↗️
          </a>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
            From: {email.from}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 line-clamp-2">
            {email.snippet}
          </p>
        </div>
        {onCategoryChange && (
          <CategoryDropdown
            currentCategory={effectiveCategory}
            onCategoryChange={(category) => onCategoryChange(email.id, category)}
            excludeConversation={true}
          />
        )}
      </div>
    </div>
  );
}
