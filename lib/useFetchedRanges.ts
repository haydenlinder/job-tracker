import { useState, useEffect, useCallback } from "react";
import { JobEmail } from "./types";

const STORAGE_KEY = "job-tracker-fetched-ranges";
const EMAILS_STORAGE_KEY = "job-tracker-cached-emails";

export interface DateRange {
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
}

interface FetchedRangesData {
  ranges: DateRange[];
  lastUpdated: string;
}

interface CachedEmailsData {
  emails: JobEmail[];
  lastUpdated: string;
}

/**
 * Parse date string to timestamp for comparison
 */
function dateToTimestamp(dateStr: string): number {
  return new Date(dateStr).getTime();
}

/**
 * Compare two dates (returns negative if a < b, 0 if equal, positive if a > b)
 */
function compareDates(a: string, b: string): number {
  return dateToTimestamp(a) - dateToTimestamp(b);
}

/**
 * Check if two date ranges overlap
 */
function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return compareDates(a.startDate, b.endDate) <= 0 && compareDates(b.startDate, a.endDate) <= 0;
}

/**
 * Merge overlapping or adjacent ranges into one
 */
function mergeRanges(ranges: DateRange[]): DateRange[] {
  if (ranges.length === 0) return [];
  
  // Sort by start date
  const sorted = [...ranges].sort((a, b) => compareDates(a.startDate, b.startDate));
  
  const merged: DateRange[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    // Check if current overlaps with or is adjacent to the last merged range
    // Adjacent means the next day after last.endDate is current.startDate
    const lastEndPlusOne = new Date(last.endDate);
    lastEndPlusOne.setDate(lastEndPlusOne.getDate() + 1);
    const lastEndPlusOneStr = lastEndPlusOne.toISOString().split('T')[0];
    
    if (compareDates(current.startDate, lastEndPlusOneStr) <= 0) {
      // Merge: extend the end date if needed
      if (compareDates(current.endDate, last.endDate) > 0) {
        last.endDate = current.endDate;
      }
    } else {
      // No overlap, add as new range
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Calculate the portions of the requested range that haven't been fetched yet
 */
export function calculateUnfetchedRanges(
  requestedRange: DateRange,
  fetchedRanges: DateRange[]
): DateRange[] {
  if (fetchedRanges.length === 0) {
    return [requestedRange];
  }
  
  // Merge fetched ranges first
  const mergedFetched = mergeRanges(fetchedRanges);
  
  // Start with the full requested range
  let unfetched: DateRange[] = [{ ...requestedRange }];
  
  // Subtract each fetched range
  for (const fetched of mergedFetched) {
    const newUnfetched: DateRange[] = [];
    
    for (const range of unfetched) {
      // If no overlap, keep the range as is
      if (!rangesOverlap(range, fetched)) {
        newUnfetched.push(range);
        continue;
      }
      
      // Calculate portions before and after the fetched range
      // Before portion: range.start to day before fetched.start
      if (compareDates(range.startDate, fetched.startDate) < 0) {
        const beforeEnd = new Date(fetched.startDate);
        beforeEnd.setDate(beforeEnd.getDate() - 1);
        const beforeEndStr = beforeEnd.toISOString().split('T')[0];
        
        if (compareDates(range.startDate, beforeEndStr) <= 0) {
          newUnfetched.push({
            startDate: range.startDate,
            endDate: compareDates(beforeEndStr, range.endDate) < 0 ? beforeEndStr : range.endDate,
          });
        }
      }
      
      // After portion: day after fetched.end to range.end
      if (compareDates(range.endDate, fetched.endDate) > 0) {
        const afterStart = new Date(fetched.endDate);
        afterStart.setDate(afterStart.getDate() + 1);
        const afterStartStr = afterStart.toISOString().split('T')[0];
        
        if (compareDates(afterStartStr, range.endDate) <= 0) {
          newUnfetched.push({
            startDate: compareDates(afterStartStr, range.startDate) > 0 ? afterStartStr : range.startDate,
            endDate: range.endDate,
          });
        }
      }
    }
    
    unfetched = newUnfetched;
  }
  
  return unfetched;
}

/**
 * Check if a date falls within any of the fetched ranges
 */
function isDateInRanges(dateStr: string, ranges: DateRange[]): boolean {
  for (const range of ranges) {
    if (compareDates(dateStr, range.startDate) >= 0 && compareDates(dateStr, range.endDate) <= 0) {
      return true;
    }
  }
  return false;
}

/**
 * Filter emails to only those within a date range
 */
export function filterEmailsByDateRange(emails: JobEmail[], range: DateRange): JobEmail[] {
  return emails.filter(email => {
    const emailDate = new Date(email.date).toISOString().split('T')[0];
    return compareDates(emailDate, range.startDate) >= 0 && compareDates(emailDate, range.endDate) <= 0;
  });
}

/**
 * Hook to manage fetched date ranges and cached emails
 */
export function useFetchedRanges() {
  const [fetchedRanges, setFetchedRanges] = useState<DateRange[]>([]);
  const [cachedEmails, setCachedEmails] = useState<JobEmail[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedRanges = localStorage.getItem(STORAGE_KEY);
      if (storedRanges) {
        const data: FetchedRangesData = JSON.parse(storedRanges);
        setFetchedRanges(data.ranges);
      }
      
      const storedEmails = localStorage.getItem(EMAILS_STORAGE_KEY);
      if (storedEmails) {
        const data: CachedEmailsData = JSON.parse(storedEmails);
        setCachedEmails(data.emails);
      }
    } catch (e) {
      console.error("Failed to load fetched ranges from localStorage:", e);
    }
    setIsLoaded(true);
  }, []);

  // Save ranges to localStorage
  const saveRanges = useCallback((ranges: DateRange[]) => {
    const merged = mergeRanges(ranges);
    setFetchedRanges(merged);
    try {
      const data: FetchedRangesData = {
        ranges: merged,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save fetched ranges to localStorage:", e);
    }
  }, []);

  // Save emails to localStorage
  const saveEmails = useCallback((emails: JobEmail[]) => {
    // Deduplicate by email ID
    const emailMap = new Map<string, JobEmail>();
    emails.forEach(email => emailMap.set(email.id, email));
    const deduped = Array.from(emailMap.values());
    
    setCachedEmails(deduped);
    try {
      const data: CachedEmailsData = {
        emails: deduped,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(EMAILS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save emails to localStorage:", e);
    }
  }, []);

  // Add a fetched range and merge with existing
  const addFetchedRange = useCallback((range: DateRange) => {
    saveRanges([...fetchedRanges, range]);
  }, [fetchedRanges, saveRanges]);

  // Add new emails (merges with existing cached emails)
  const addEmails = useCallback((newEmails: JobEmail[]) => {
    saveEmails([...cachedEmails, ...newEmails]);
  }, [cachedEmails, saveEmails]);

  // Get unfetched portions of a requested range
  const getUnfetchedRanges = useCallback((requestedRange: DateRange): DateRange[] => {
    return calculateUnfetchedRanges(requestedRange, fetchedRanges);
  }, [fetchedRanges]);

  // Get cached emails for a date range
  const getCachedEmailsForRange = useCallback((range: DateRange): JobEmail[] => {
    return filterEmailsByDateRange(cachedEmails, range);
  }, [cachedEmails]);

  // Check if a range is fully fetched (no unfetched portions)
  const isRangeFullyFetched = useCallback((range: DateRange): boolean => {
    const unfetched = calculateUnfetchedRanges(range, fetchedRanges);
    return unfetched.length === 0;
  }, [fetchedRanges]);

  // Clear all cached data
  const clearCache = useCallback(() => {
    setFetchedRanges([]);
    setCachedEmails([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(EMAILS_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear cache from localStorage:", e);
    }
  }, []);

  return {
    fetchedRanges,
    cachedEmails,
    isLoaded,
    addFetchedRange,
    addEmails,
    getUnfetchedRanges,
    getCachedEmailsForRange,
    isRangeFullyFetched,
    clearCache,
  };
}
