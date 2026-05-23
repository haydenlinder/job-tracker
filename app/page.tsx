"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import UserAvatar from "./components/UserAvatar";
import CategorySection from "./components/CategorySection";
import ConversationSection, { ConversationGroup } from "./components/ConversationSection";
import { CATEGORIES, EmailStats, JobEmail } from "@/lib/types";
import { useCategoryOverrides } from "@/lib/useCategoryOverrides";
import { useFetchedRanges, DateRange, filterEmailsByDateRange } from "@/lib/useFetchedRanges";

async function fetchJobEmailsApi(startDate: string, endDate: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  
  const res = await fetch(`/api/gmail/job-emails?${params.toString()}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch emails");
  }

  return data as { emails: JobEmail[]; stats: EmailStats };
}

// Helper to format date as YYYY-MM-DD
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get default date range (last 30 days)
function getDefaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: formatDateForInput(start),
    endDate: formatDateForInput(end),
  };
}

// Validate date range is within 1 year
function isValidDateRange(start: string, end: string): { valid: boolean; error?: string } {
  if (!start || !end) return { valid: true };
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  
  if (startDate > endDate) {
    return { valid: false, error: "Start date must be before end date" };
  }
  
  if (endDate.getTime() - startDate.getTime() > oneYearMs) {
    return { valid: false, error: "Date range cannot exceed 1 year" };
  }
  
  return { valid: true };
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { overrides, setEmailCategory, setThreadCategory } = useCategoryOverrides();
  
  // Date range state with defaults
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [dateError, setDateError] = useState<string | null>(null);

  // Fetched ranges tracking
  const {
    fetchedRanges,
    cachedEmails,
    isLoaded: isCacheLoaded,
    addFetchedRange,
    addEmails,
    getUnfetchedRanges,
    isRangeFullyFetched,
    clearCache,
  } = useFetchedRanges();

  // Fetch state
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasTriggeredFetch, setHasTriggeredFetch] = useState(false);

  // Get emails for current date range (from cache)
  const emails = useMemo(() => {
    if (!isCacheLoaded) return [];
    return filterEmailsByDateRange(cachedEmails, dateRange);
  }, [cachedEmails, dateRange, isCacheLoaded]);

  // Smart fetch function that only fetches unfetched portions
  const fetchEmails = useCallback(async () => {
    setError(null);
    setHasTriggeredFetch(true);
    
    const unfetchedRanges = getUnfetchedRanges(dateRange);
    
    // If everything is already fetched, no need to call API
    if (unfetchedRanges.length === 0) {
      console.log("Date range already fully cached, skipping API call");
      return;
    }
    
    setIsFetching(true);
    console.log("Fetching unfetched ranges:", unfetchedRanges);
    
    try {
      // Fetch each unfetched range
      const allNewEmails: JobEmail[] = [];
      
      for (const range of unfetchedRanges) {
        const result = await fetchJobEmailsApi(range.startDate, range.endDate);
        allNewEmails.push(...result.emails);
        // Add this range to the fetched ranges
        addFetchedRange(range);
      }
      
      // Add new emails to cache
      if (allNewEmails.length > 0) {
        addEmails(allNewEmails);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch emails"));
    } finally {
      setIsFetching(false);
    }
  }, [dateRange, getUnfetchedRanges, addFetchedRange, addEmails]);

  // Handle date changes with validation
  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newRange = { ...dateRange, [field]: value };
    const validation = isValidDateRange(newRange.startDate, newRange.endDate);
    
    setDateRange(newRange);
    setDateError(validation.valid ? null : validation.error || null);
  };

  // Show data if a fetch has been triggered and cache is loaded
  const hasLoaded = hasTriggeredFetch && isCacheLoaded;
  
  // Check if current range is fully cached
  const isFullyCached = useMemo(() => {
    if (!isCacheLoaded) return false;
    return isRangeFullyFetched(dateRange);
  }, [isCacheLoaded, isRangeFullyFetched, dateRange]);

  // Helper to check if email is from a no-reply address
  const isNoReplyEmail = (email: JobEmail): boolean => {
    const fromLower = email.from.toLowerCase();
    return fromLower.includes('no-reply@') || fromLower.includes('noreply@');
  };

  // Group emails by threadId to detect conversations, respecting overrides
  const { conversations, singleEmails, movedThreads } = useMemo(() => {
    const threadMap = new Map<string, JobEmail[]>();
    
    // Group all emails by threadId
    emails.forEach((email) => {
      const existing = threadMap.get(email.threadId) || [];
      existing.push(email);
      threadMap.set(email.threadId, existing);
    });
    
    // Separate conversations (2+ non-no-reply emails) from single emails
    // Also track threads that have been moved to a different category
    // Note: Threads where ALL emails are from no-reply addresses are NOT shown as conversations
    const conversationGroups: ConversationGroup[] = [];
    const singles: JobEmail[] = [];
    const moved: { threadId: string; emails: JobEmail[]; category: CATEGORIES }[] = [];
    
    threadMap.forEach((threadEmails, threadId) => {
      const threadOverride = overrides.threads[threadId];
      
      // Filter out no-reply emails when determining if this is a conversation
      const nonNoReplyEmails = threadEmails.filter(e => !isNoReplyEmail(e));
      
      // Only treat as conversation if there are 2+ non-no-reply emails
      if (nonNoReplyEmails.length > 1) {
        // Sort by date (oldest first) within conversation
        threadEmails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        if (threadOverride && threadOverride !== CATEGORIES.CONVERSATION) {
          // Thread has been moved to a different category
          moved.push({
            threadId,
            emails: threadEmails,
            category: threadOverride,
          });
        } else {
          // Thread stays in conversations
          conversationGroups.push({
            threadId,
            emails: threadEmails,
            subject: threadEmails[0].subject,
          });
        }
      } else {
        singles.push(threadEmails[0]);
      }
    });
    
    // Sort conversations by most recent email
    conversationGroups.sort((a, b) => {
      const aLatest = new Date(a.emails[a.emails.length - 1].date).getTime();
      const bLatest = new Date(b.emails[b.emails.length - 1].date).getTime();
      return bLatest - aLatest;
    });
    
    return { conversations: conversationGroups, singleEmails: singles, movedThreads: moved };
  }, [emails, overrides.threads]);

  // Group single emails by category, respecting overrides
  // Also include the first email from moved threads (to represent the thread in that category)
  const emailsByCategory = useMemo(() => {
    const grouped = {
      application: [] as JobEmail[],
      interview: [] as JobEmail[],
      offer: [] as JobEmail[],
      rejection: [] as JobEmail[],
      other: [] as JobEmail[],
      opportunity: [] as JobEmail[],
      conversation: [] as JobEmail[],
    };
    
    // Add single emails, respecting individual email overrides
    singleEmails.forEach((email) => {
      const effectiveCategory = overrides.emails[email.id] ?? email.category;
      if (effectiveCategory !== CATEGORIES.CONVERSATION) {
        grouped[effectiveCategory].push(email);
      }
    });
    
    // Add first email from moved threads to represent the thread
    movedThreads.forEach(({ emails: threadEmails, category }) => {
      // Use the most recent email to represent the thread
      const representativeEmail = threadEmails[threadEmails.length - 1];
      grouped[category].push(representativeEmail);
    });
    
    return grouped;
  }, [singleEmails, movedThreads, overrides.emails]);

  // Compute stats from frontend data (respects user overrides)
  const stats = useMemo((): EmailStats | null => {
    if (emails.length === 0) return null;
    
    const byCategory: Record<CATEGORIES, number> = {
      [CATEGORIES.APPLICATION]: emailsByCategory.application.length,
      [CATEGORIES.INTERVIEW]: emailsByCategory.interview.length,
      [CATEGORIES.OFFER]: emailsByCategory.offer.length,
      [CATEGORIES.REJECTION]: emailsByCategory.rejection.length,
      [CATEGORIES.OPPORTUNITY]: emailsByCategory.opportunity.length,
      [CATEGORIES.OTHER]: emailsByCategory.other.length,
      [CATEGORIES.CONVERSATION]: conversations.length,
    };
    
    const total = Object.values(byCategory).reduce((sum, count) => sum + count, 0);
    
    return { total, byCategory };
  }, [emails.length, emailsByCategory, conversations.length]);

  // Handler for moving individual emails
  const handleEmailCategoryChange = (emailId: string, category: CATEGORIES) => {
    setEmailCategory(emailId, category);
  };

  // Handler for moving entire threads
  const handleThreadCategoryChange = (threadId: string, category: CATEGORIES) => {
    setThreadCategory(threadId, category);
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error("Failed to check auth status:", error);
    }
  }


  return (
    <div className="flex flex-col flex-1 min-h-screen bg-zinc-50 dark:bg-black font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Job Search Tracker
          </h1>
          <UserAvatar />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {!isAuthenticated ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Connect your Gmail
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Sign in with Google to track your job applications
            </p>
            <a
              href="/api/auth/google"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </a>
          </div>
        ) : (
          <>
            {/* Date Range Picker */}
            <div className="mb-6 p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    max={dateRange.endDate || formatDateForInput(new Date())}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    min={dateRange.startDate}
                    max={formatDateForInput(new Date())}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => fetchEmails()}
                  disabled={isFetching || !!dateError}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {isFetching ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    "Fetch Emails"
                  )}
                </button>
              </div>
              {dateError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{dateError}</p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select a date range up to 1 year. Defaults to the last 30 days.
                  {isFullyCached && (
                    <span className="ml-2 text-green-600 dark:text-green-400">
                      ✓ Cached
                    </span>
                  )}
                </p>
                {fetchedRanges.length > 0 && (
                  <button
                    onClick={clearCache}
                    className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline"
                  >
                    Clear cache
                  </button>
                )}
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                {error.message}
              </div>
            )}

            {/* Stats */}
            {stats && emails.length && (
              <div className="mb-8 grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {stats.total}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Total
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {stats.byCategory.application}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">
                    Applications
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {stats.byCategory.interview}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">
                    Interviews
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {stats.byCategory.offer}
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-400">
                    Offers
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {stats.byCategory.rejection}
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Not for me
                  </div>
                </div>
              </div>
            )}

            {/* Email Categories */}
            {hasLoaded && emails.length === 0 && !error && (
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                No job-related emails found.
              </div>
            )}

            {emails.length > 0 && (
              <div className="space-y-4">
                <ConversationSection
                  conversations={conversations}
                  defaultOpen={true}
                  onThreadCategoryChange={handleThreadCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.INTERVIEW}
                  emails={emailsByCategory.interview}
                  defaultOpen={true}
                  onCategoryChange={handleEmailCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.OPPORTUNITY}
                  emails={emailsByCategory.opportunity}
                  defaultOpen={true}
                  onCategoryChange={handleEmailCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.OFFER}
                  emails={emailsByCategory.offer}
                  defaultOpen={true}
                  onCategoryChange={handleEmailCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.APPLICATION}
                  emails={emailsByCategory.application}
                  onCategoryChange={handleEmailCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.REJECTION}
                  emails={emailsByCategory.rejection}
                  onCategoryChange={handleEmailCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.OTHER}
                  emails={emailsByCategory.other}
                  onCategoryChange={handleEmailCategoryChange}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
