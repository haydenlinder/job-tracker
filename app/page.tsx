"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import UserAvatar from "./components/UserAvatar";
import CategorySection from "./components/CategorySection";
import { CATEGORIES, CompanyGroup, EmailStats, JobEmail } from "@/lib/types";
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
  const { overrides, setThreadCategory } = useCategoryOverrides();
  
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

  // Helper function to extract company name from email (for backwards compatibility with cached emails)
  const getCompanyName = (email: JobEmail): string => {
    // If email already has companyName, use it
    if (email.companyName) {
      return email.companyName;
    }
    
    // Fallback: extract from "from" header
    // Try to get domain name
    const from = email.from;
    const domain = from.slice(from.lastIndexOf("@") + 1).split(">")[0];
    const domains = domain.split(".");
    const secondLevelDomain = domains[domains.length - 2]?.toLowerCase();
    
    const commonDomains = [
      "gmail", "smartrecruiters", "lever", "greenhouse", "indeed",
      "ashbyhq", "greenhouse-mail", "myworkday", "governmentjobs",
      "hiring", "gem", "yahoo", "outlook", "hotmail", "aol", "icloud", "protonmail"
    ];
    
    if (secondLevelDomain && secondLevelDomain.length > 2 && !commonDomains.includes(secondLevelDomain)) {
      return secondLevelDomain.charAt(0).toUpperCase() + secondLevelDomain.slice(1);
    }
    
    // Extract name from "from" header (e.g., "Company Name <email@example.com>")
    const nameMatch = from.match(/^([^<]+)</);
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1].trim();
    }
    
    // Fallback to the email address
    return from;
  };

  // Group emails by company name and then by category
  // The company's category is determined by the most recent email's category (or override)
  const companyGroupsByCategory = useMemo(() => {
    // First, group all emails by company name (case-insensitive)
    const companyMap = new Map<string, JobEmail[]>();
    
    // Track the user's "from" addresses to exclude them as company names
    const userFromAddresses = new Set<string>();
    
    // First pass: identify user's sent emails to capture their "from" patterns
    emails.forEach((email) => {
      if (email.labels.includes("SENT")) {
        // Extract domain or name pattern from user's sent emails
        const from = email.from.toLowerCase();
        userFromAddresses.add(from);
        // Also add the email domain to exclude
        const domainMatch = from.match(/@([^>]+)/);
        if (domainMatch) {
          userFromAddresses.add(domainMatch[1].split(">")[0]);
        }
      }
    });
    
    emails.forEach((email) => {
      // Skip user's sent emails - they shouldn't create their own company group
      if (email.labels.includes("SENT")) {
        return;
      }
      
      const companyName = getCompanyName(email);
      const normalizedCompanyName = companyName.toLowerCase();
      
      // Skip if this would match the user's own address
      if (userFromAddresses.has(normalizedCompanyName)) {
        return;
      }
      
      const existing = companyMap.get(normalizedCompanyName) || [];
      existing.push({ ...email, companyName }); // Ensure companyName is set
      companyMap.set(normalizedCompanyName, existing);
    });
    
    // Second pass: add user's sent emails to the appropriate company groups
    emails.forEach((email) => {
      if (!email.labels.includes("SENT")) {
        return;
      }
      
      // For sent emails, try to find which company they belong to
      // by matching the thread ID or looking at other emails in the same thread
      const existingInThread = emails.find(e => 
        e.threadId === email.threadId && !e.labels.includes("SENT")
      );
      
      if (existingInThread) {
        const companyName = getCompanyName(existingInThread);
        const normalizedCompanyName = companyName.toLowerCase();
        const existing = companyMap.get(normalizedCompanyName);
        if (existing) {
          existing.push({ ...email, companyName }); // Add sent email to existing company group
        }
      }
    });
    
    // Now create company groups and determine their category
    const grouped: Record<CATEGORIES, CompanyGroup[]> = {
      [CATEGORIES.APPLICATION]: [],
      [CATEGORIES.INTERVIEW]: [],
      [CATEGORIES.OFFER]: [],
      [CATEGORIES.REJECTION]: [],
      [CATEGORIES.OPPORTUNITY]: [],
      [CATEGORIES.OTHER]: [],
      [CATEGORIES.CONVERSATION]: [],
    };
    
    companyMap.forEach((companyEmails, normalizedName) => {
      // Sort emails by date (oldest first)
      companyEmails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Get the display company name from the first email (preserves case)
      const displayCompanyName = companyEmails[0].companyName;
      
      // Get the most recent email to determine category
      const mostRecentEmail = companyEmails[companyEmails.length - 1];
      
      // Check for company-level override first (using the company: prefix)
      let effectiveCategory: CATEGORIES | null = null;
      
      // Check company-level override (highest priority)
      const companyOverride = overrides.threads[`company:${normalizedName}`];
      if (companyOverride) {
        effectiveCategory = companyOverride;
      }
      
      // If no company override, check thread-level overrides
      if (!effectiveCategory) {
        for (const email of companyEmails) {
          const threadOverride = overrides.threads[email.threadId];
          if (threadOverride) {
            effectiveCategory = threadOverride;
            break;
          }
        }
      }
      
      // Check individual email overrides (most recent takes precedence)
      if (!effectiveCategory) {
        for (let i = companyEmails.length - 1; i >= 0; i--) {
          const emailOverride = overrides.emails[companyEmails[i].id];
          if (emailOverride) {
            effectiveCategory = emailOverride;
            break;
          }
        }
      }
      
      // If no override, use the most recent email's category
      if (!effectiveCategory) {
        effectiveCategory = mostRecentEmail.category;
      }
      
      // Don't put company groups in "conversation" category - that's for threads only
      if (effectiveCategory === CATEGORIES.CONVERSATION) {
        effectiveCategory = mostRecentEmail.category;
      }
      
      const companyGroup: CompanyGroup = {
        companyName: displayCompanyName,
        emails: companyEmails,
        category: effectiveCategory,
      };
      
      grouped[effectiveCategory].push(companyGroup);
    });
    
    // Sort each category's company groups by most recent email
    Object.values(grouped).forEach((groups) => {
      groups.sort((a, b) => {
        const aLatest = new Date(a.emails[a.emails.length - 1].date).getTime();
        const bLatest = new Date(b.emails[b.emails.length - 1].date).getTime();
        return bLatest - aLatest;
      });
    });
    
    return grouped;
  }, [emails, overrides.threads, overrides.emails]);

  // Compute stats from frontend data (respects user overrides)
  // Now counts company groups instead of individual emails
  const stats = useMemo((): EmailStats | null => {
    if (emails.length === 0) return null;
    
    const byCategory: Record<CATEGORIES, number> = {
      [CATEGORIES.APPLICATION]: companyGroupsByCategory[CATEGORIES.APPLICATION].length,
      [CATEGORIES.INTERVIEW]: companyGroupsByCategory[CATEGORIES.INTERVIEW].length,
      [CATEGORIES.OFFER]: companyGroupsByCategory[CATEGORIES.OFFER].length,
      [CATEGORIES.REJECTION]: companyGroupsByCategory[CATEGORIES.REJECTION].length,
      [CATEGORIES.OPPORTUNITY]: companyGroupsByCategory[CATEGORIES.OPPORTUNITY].length,
      [CATEGORIES.OTHER]: companyGroupsByCategory[CATEGORIES.OTHER].length,
      [CATEGORIES.CONVERSATION]: 0, // No longer used
    };
    
    const total = Object.values(byCategory).reduce((sum, count) => sum + count, 0);
    
    return { total, byCategory };
  }, [emails.length, companyGroupsByCategory]);

  // Handler for moving company groups (uses the company name as a key in threads overrides)
  const handleCompanyGroupCategoryChange = (companyName: string, category: CATEGORIES) => {
    // Use company name as a pseudo-thread ID for overrides
    setThreadCategory(`company:${companyName.toLowerCase()}`, category);
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
                <CategorySection
                  category={CATEGORIES.INTERVIEW}
                  companyGroups={companyGroupsByCategory[CATEGORIES.INTERVIEW]}
                  defaultOpen={true}
                  onCompanyGroupCategoryChange={handleCompanyGroupCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.OPPORTUNITY}
                  companyGroups={companyGroupsByCategory[CATEGORIES.OPPORTUNITY]}
                  defaultOpen={true}
                  onCompanyGroupCategoryChange={handleCompanyGroupCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.OFFER}
                  companyGroups={companyGroupsByCategory[CATEGORIES.OFFER]}
                  defaultOpen={true}
                  onCompanyGroupCategoryChange={handleCompanyGroupCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.APPLICATION}
                  companyGroups={companyGroupsByCategory[CATEGORIES.APPLICATION]}
                  onCompanyGroupCategoryChange={handleCompanyGroupCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.REJECTION}
                  companyGroups={companyGroupsByCategory[CATEGORIES.REJECTION]}
                  onCompanyGroupCategoryChange={handleCompanyGroupCategoryChange}
                />
                <CategorySection
                  category={CATEGORIES.OTHER}
                  companyGroups={companyGroupsByCategory[CATEGORIES.OTHER]}
                  onCompanyGroupCategoryChange={handleCompanyGroupCategoryChange}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
