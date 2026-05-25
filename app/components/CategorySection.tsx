"use client";

import { useState } from "react";
import JobEmailCard from "./JobEmailCard";
import CategoryDropdown from "./CategoryDropdown";
import { CATEGORIES, CompanyGroup } from "@/lib/types";

interface CategorySectionProps {
  category: CATEGORIES;
  companyGroups: CompanyGroup[];
  defaultOpen?: boolean;
  onCompanyGroupCategoryChange?: (companyName: string, category: CATEGORIES) => void;
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
    groupBorder: "border-blue-200 dark:border-blue-800",
    groupBg: "bg-blue-50/50 dark:bg-blue-900/20",
    groupHoverBg: "hover:bg-blue-50 dark:hover:bg-blue-900/30",
  },
  interview: {
    label: "Interviews",
    icon: "🎯",
    headerBg: "bg-green-50 dark:bg-green-900/30",
    headerBorder: "border-green-200 dark:border-green-800",
    headerText: "text-green-800 dark:text-green-200",
    countBg: "bg-green-200 dark:bg-green-800",
    countText: "text-green-800 dark:text-green-200",
    groupBorder: "border-green-200 dark:border-green-800",
    groupBg: "bg-green-50/50 dark:bg-green-900/20",
    groupHoverBg: "hover:bg-green-50 dark:hover:bg-green-900/30",
  },
  offer: {
    label: "Offers",
    icon: "🎉",
    headerBg: "bg-purple-50 dark:bg-purple-900/30",
    headerBorder: "border-purple-200 dark:border-purple-800",
    headerText: "text-purple-800 dark:text-purple-200",
    countBg: "bg-purple-200 dark:bg-purple-800",
    countText: "text-purple-800 dark:text-purple-200",
    groupBorder: "border-purple-200 dark:border-purple-800",
    groupBg: "bg-purple-50/50 dark:bg-purple-900/20",
    groupHoverBg: "hover:bg-purple-50 dark:hover:bg-purple-900/30",
  },
  rejection: {
    label: "Not for me",
    icon: "❌",
    headerBg: "bg-red-50 dark:bg-red-900/30",
    headerBorder: "border-red-200 dark:border-red-800",
    headerText: "text-red-800 dark:text-red-200",
    countBg: "bg-red-200 dark:bg-red-800",
    countText: "text-red-800 dark:text-red-200",
    groupBorder: "border-red-200 dark:border-red-800",
    groupBg: "bg-red-50/50 dark:bg-red-900/20",
    groupHoverBg: "hover:bg-red-50 dark:hover:bg-red-900/30",
  },
  other: {
    label: "Other",
    icon: "📧",
    headerBg: "bg-zinc-50 dark:bg-zinc-800/50",
    headerBorder: "border-zinc-200 dark:border-zinc-700",
    headerText: "text-zinc-800 dark:text-zinc-200",
    countBg: "bg-zinc-200 dark:bg-zinc-700",
    countText: "text-zinc-800 dark:text-zinc-200",
    groupBorder: "border-zinc-200 dark:border-zinc-700",
    groupBg: "bg-zinc-50/50 dark:bg-zinc-800/50",
    groupHoverBg: "hover:bg-zinc-50 dark:hover:bg-zinc-800",
  },
  opportunity: {
    label: "Opportunity",
    icon: "💼",
    headerBg: "bg-amber-50 dark:bg-amber-900/30",
    headerBorder: "border-amber-200 dark:border-amber-800",
    headerText: "text-amber-800 dark:text-amber-200",
    countBg: "bg-amber-200 dark:bg-amber-800",
    countText: "text-amber-800 dark:text-amber-200",
    groupBorder: "border-amber-200 dark:border-amber-800",
    groupBg: "bg-amber-50/50 dark:bg-amber-900/20",
    groupHoverBg: "hover:bg-amber-50 dark:hover:bg-amber-900/30",
  },
  conversation: {
    label: "Conversations",
    icon: "💬",
    headerBg: "bg-amber-50 dark:bg-amber-900/30",
    headerBorder: "border-amber-200 dark:border-amber-800",
    headerText: "text-amber-800 dark:text-amber-200",
    countBg: "bg-amber-200 dark:bg-amber-800",
    countText: "text-amber-800 dark:text-amber-200",
    groupBorder: "border-amber-200 dark:border-amber-800",
    groupBg: "bg-amber-50/50 dark:bg-amber-900/20",
    groupHoverBg: "hover:bg-amber-50 dark:hover:bg-amber-900/30",
  },
};

export default function CategorySection({
  category,
  companyGroups,
  defaultOpen = false,
  onCompanyGroupCategoryChange,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const config = categoryConfig[category];

  if (companyGroups.length === 0) {
    return null;
  }

  const toggleCompany = (companyName: string) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(companyName)) {
      newExpanded.delete(companyName);
    } else {
      newExpanded.add(companyName);
    }
    setExpandedCompanies(newExpanded);
  };

  const totalEmails = companyGroups.reduce((acc, group) => acc + group.emails.length, 0);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
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
            {companyGroups.length} companies • {totalEmails} emails
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
          {companyGroups.map((group) => (
            <div
              key={group.companyName}
              className={`rounded-lg border ${config.groupBorder}`}
            >
              <div className={`flex items-center justify-between p-3 ${config.groupBg} ${config.groupHoverBg} transition-colors`}>
                <button
                  onClick={() => toggleCompany(group.companyName)}
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                >
                  <span className={config.headerText}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {group.companyName}
                  </span>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${config.countBg} ${config.countText}`}>
                    {group.emails.length} {group.emails.length === 1 ? 'email' : 'emails'}
                  </span>
                  <svg
                    className={`flex-shrink-0 w-4 h-4 ${config.headerText} transition-transform duration-200 ml-2 ${
                      expandedCompanies.has(group.companyName) ? "rotate-180" : ""
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
                {onCompanyGroupCategoryChange && (
                  <CategoryDropdown
                    currentCategory={category}
                    onCategoryChange={(newCategory) => onCompanyGroupCategoryChange(group.companyName, newCategory)}
                    excludeConversation={true}
                  />
                )}
              </div>

              {expandedCompanies.has(group.companyName) && (
                <div className={`p-3 space-y-2 bg-white dark:bg-zinc-900 border-t ${config.groupBorder}`}>
                  {[...group.emails].reverse().map((email) => (
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
