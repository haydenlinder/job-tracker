"use client";

import { useState } from "react";
import JobEmailCard from "./JobEmailCard";
import { CATEGORIES, JobEmail } from "@/lib/types";

interface CategorySectionProps {
  category: CATEGORIES
  emails: JobEmail[];
  defaultOpen?: boolean;
}

const categoryConfig = {
  application: {
    label: "Applications",
    icon: "📝",
    headerBg: "bg-blue-50 dark:bg-blue-900/30",
    headerBorder: "border-blue-200 dark:border-blue-800",
    headerText: "text-blue-800 dark:text-blue-200",
    countBg: "bg-blue-200 dark:bg-blue-800",
    countText: "text-blue-800 dark:text-blue-200",
  },
  interview: {
    label: "Interviews",
    icon: "🎯",
    headerBg: "bg-green-50 dark:bg-green-900/30",
    headerBorder: "border-green-200 dark:border-green-800",
    headerText: "text-green-800 dark:text-green-200",
    countBg: "bg-green-200 dark:bg-green-800",
    countText: "text-green-800 dark:text-green-200",
  },
  offer: {
    label: "Offers",
    icon: "🎉",
    headerBg: "bg-purple-50 dark:bg-purple-900/30",
    headerBorder: "border-purple-200 dark:border-purple-800",
    headerText: "text-purple-800 dark:text-purple-200",
    countBg: "bg-purple-200 dark:bg-purple-800",
    countText: "text-purple-800 dark:text-purple-200",
  },
  rejection: {
    label: "Rejections",
    icon: "❌",
    headerBg: "bg-red-50 dark:bg-red-900/30",
    headerBorder: "border-red-200 dark:border-red-800",
    headerText: "text-red-800 dark:text-red-200",
    countBg: "bg-red-200 dark:bg-red-800",
    countText: "text-red-800 dark:text-red-200",
  },
  other: {
    label: "Other",
    icon: "📧",
    headerBg: "bg-zinc-50 dark:bg-zinc-800/50",
    headerBorder: "border-zinc-200 dark:border-zinc-700",
    headerText: "text-zinc-800 dark:text-zinc-200",
    countBg: "bg-zinc-200 dark:bg-zinc-700",
    countText: "text-zinc-800 dark:text-zinc-200",
  },
  opportunity: {
    label: "Opportunity",
    icon: "📧",
    headerBg: "bg-zinc-50 dark:bg-zinc-800/50",
    headerBorder: "border-zinc-200 dark:border-zinc-700",
    headerText: "text-zinc-800 dark:text-zinc-200",
    countBg: "bg-zinc-200 dark:bg-zinc-700",
    countText: "text-zinc-800 dark:text-zinc-200",
  },
};

export default function CategorySection({
  category,
  emails,
  defaultOpen = false,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const config = categoryConfig[category];

  if (emails.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 ${config.headerBg} ${config.headerBorder} border-b transition-colors hover:opacity-90 cursor-pointer`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{config.icon}</span>
          <span className={`font-semibold ${config.headerText}`}>
            {config.label}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.countBg} ${config.countText}`}
          >
            {emails.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 ${config.headerText} transition-transform duration-200 ${
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
          {emails.map((email) => (
            <JobEmailCard key={email.id} email={email} />
          ))}
        </div>
      )}
    </div>
  );
}
