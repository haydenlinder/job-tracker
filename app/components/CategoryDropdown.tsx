"use client";

import { useState, useRef, useEffect } from "react";
import { CATEGORIES } from "@/lib/types";

interface CategoryDropdownProps {
  currentCategory: CATEGORIES;
  onCategoryChange: (category: CATEGORIES) => void;
  excludeConversation?: boolean;
}

const categoryOptions: { value: CATEGORIES; label: string; icon: string }[] = [
  { value: CATEGORIES.APPLICATION, label: "Applications", icon: "📝" },
  { value: CATEGORIES.INTERVIEW, label: "Interviews", icon: "🎯" },
  { value: CATEGORIES.OFFER, label: "Offers", icon: "🎉" },
  { value: CATEGORIES.REJECTION, label: "Not for me", icon: "❌" },
  { value: CATEGORIES.OPPORTUNITY, label: "Opportunity", icon: "💼" },
  { value: CATEGORIES.OTHER, label: "Other", icon: "📧" },
  { value: CATEGORIES.CONVERSATION, label: "Conversations", icon: "💬" },
];

export default function CategoryDropdown({
  currentCategory,
  onCategoryChange,
  excludeConversation = false,
}: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = excludeConversation
    ? categoryOptions.filter((opt) => opt.value !== CATEGORIES.CONVERSATION)
    : categoryOptions;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
        title="Move to category"
      >
        <svg
          className="w-4 h-4 text-zinc-500 dark:text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 overflow-hidden">
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
            Move to...
          </div>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                onCategoryChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer ${
                currentCategory === option.value
                  ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <span>{option.icon}</span>
              <span>{option.label}</span>
              {currentCategory === option.value && (
                <svg
                  className="w-4 h-4 ml-auto text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
