"use client";

import { useState, useEffect, useCallback } from "react";
import { CATEGORIES } from "./types";

const STORAGE_KEY = "job-tracker-category-overrides";

export type CategoryOverrides = {
  // Single email overrides (by email id)
  emails: Record<string, CATEGORIES>;
  // Thread/conversation overrides (by threadId)
  threads: Record<string, CATEGORIES>;
};

function loadOverrides(): CategoryOverrides {
  if (typeof window === "undefined") {
    return { emails: {}, threads: {} };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load category overrides:", e);
  }
  return { emails: {}, threads: {} };
}

function saveOverrides(overrides: CategoryOverrides) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error("Failed to save category overrides:", e);
  }
}

export function useCategoryOverrides() {
  const [overrides, setOverrides] = useState<CategoryOverrides>({ emails: {}, threads: {} });

  // Load overrides from localStorage on mount
  useEffect(() => {
    setOverrides(loadOverrides());
  }, []);

  const setEmailCategory = useCallback((emailId: string, category: CATEGORIES | null) => {
    setOverrides((prev) => {
      const newOverrides = { ...prev, emails: { ...prev.emails } };
      if (category === null) {
        delete newOverrides.emails[emailId];
      } else {
        newOverrides.emails[emailId] = category;
      }
      saveOverrides(newOverrides);
      return newOverrides;
    });
  }, []);

  const setThreadCategory = useCallback((threadId: string, category: CATEGORIES | null) => {
    setOverrides((prev) => {
      const newOverrides = { ...prev, threads: { ...prev.threads } };
      if (category === null) {
        delete newOverrides.threads[threadId];
      } else {
        newOverrides.threads[threadId] = category;
      }
      saveOverrides(newOverrides);
      return newOverrides;
    });
  }, []);

  const getEmailCategory = useCallback(
    (emailId: string, defaultCategory: CATEGORIES): CATEGORIES => {
      return overrides.emails[emailId] ?? defaultCategory;
    },
    [overrides.emails]
  );

  const getThreadCategory = useCallback(
    (threadId: string): CATEGORIES | null => {
      return overrides.threads[threadId] ?? null;
    },
    [overrides.threads]
  );

  const clearAllOverrides = useCallback(() => {
    const empty = { emails: {}, threads: {} };
    setOverrides(empty);
    saveOverrides(empty);
  }, []);

  return {
    overrides,
    setEmailCategory,
    setThreadCategory,
    getEmailCategory,
    getThreadCategory,
    clearAllOverrides,
  };
}
