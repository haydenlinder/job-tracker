import { google, gmail_v1 } from "googleapis";
import { CATEGORIES, EmailStats, JobEmail } from "./types";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI
);

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

/**
 * Generate the Google OAuth2 authorization URL
 */
export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Create an authenticated Gmail client
 */
export function getGmailClient(accessToken: string, refreshToken?: string) {
  const authClient = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  authClient.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.gmail({ version: "v1", auth: authClient });
}

/**
 * Job search related keywords to filter emails
 */
const JOB_SEARCH_KEYWORDS = [
  "job application",
  "intro call",
  "your application",
  "application received",
  "application status",
  "interview invitation",
  "interview scheduled",
  "phone screen",
  "technical interview",
  "coding interview",
  "take-home",
  "take home assignment",
  "onsite interview",
  "recruitment",
  "recruiter",
  "job offer",
  "offer letter",
  "position",
  "opportunity",
  "career",
  "cv received",
  "thank you for applying",
  "application update",
  "next steps",
  "we regret",
  "unfortunately",
  "moved forward",
  "not moving forward",
  "background check",
  "reference check",
  "salary",
  "start date",
  "onboarding",
];



/**
 * Build Gmail search query for job-related emails
 */
function buildJobSearchQuery(startDate?: string, endDate?: string): string {
  // Search in subject or body for job-related terms
  const keywordQueries = JOB_SEARCH_KEYWORDS.map((kw) => `"${kw}"`).join(" OR ");
  let query = `(${keywordQueries})`;
  
  // Add date filters if provided (Gmail uses after: and before: with YYYY/MM/DD format)
  if (startDate) {
    const formattedStart = startDate.replace(/-/g, '/');
    query += ` after:${formattedStart}`;
  }
  if (endDate) {
    const formattedEnd = endDate.replace(/-/g, '/');
    query += ` before:${formattedEnd}`;
  }
  
  return query;
}
/**
 * Build Gmail search query for job-related emails
 */
function buildJobApplicationQuery(companyName: string, startDate?: string, endDate?: string): string {
  // Search in subject or body for job application related terms and the company name
  const keywordQueries = `"application" AND "${companyName}"`;
  let query = `(${keywordQueries})`;
  
  // Add date filters if provided (Gmail uses after: and before: with YYYY/MM/DD format)
  if (startDate) {
    const formattedStart = startDate.replace(/-/g, '/');
    query += ` after:${formattedStart}`;
  }
  if (endDate) {
    const formattedEnd = endDate.replace(/-/g, '/');
    query += ` before:${formattedEnd}`;
  }
  
  return query;
}

/**
 * Check if email contains a calendar invite
 */
function hasCalendarInvite(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!payload) return false;

  // Check the main MIME type
  if (payload.mimeType === "text/calendar" || payload.mimeType === "application/ics") {
    return true;
  }

  // Check parts for calendar attachments
  if (payload.parts) {
    for (const part of payload.parts) {
      if (
        part.mimeType === "text/calendar" ||
        part.mimeType === "application/ics" ||
        part.filename?.endsWith(".ics")
      ) {
        return true;
      }
      // Recursively check nested parts
      if (part.parts && hasCalendarInvite(part)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Categorize an email based on its content
 */
function categorizeEmail(
  subject: string,
  snippet: string,
  from: string,
  isCalendarInvite: boolean = false
): JobEmail["category"] {
  // Calendar invites are automatically categorized as interviews
  if (isCalendarInvite) {
    return CATEGORIES.INTERVIEW;
  }

  const text = `${subject} ${snippet}`.toLowerCase();

  if (
    (from.includes("ashbyhq") && subject.match(/your.*application/i) )||
    text.includes("regret") ||
    text.includes("unfortunately") ||
    text.includes("not moving forward") ||
    text.includes("decided not to") ||
    text.includes("not an easy decision") ||
    text.includes("at this time") 
  ) {
    return CATEGORIES.REJECTION;
  }

  if (
    text.includes("application") ||
    text.includes("applied")
  ) {
    return CATEGORIES.APPLICATION;
  }

  if (
    text.includes("opportunity")
  ) {
    return CATEGORIES.OPPORTUNITY;
  }
  
  if (
    text.includes("interview") ||
    text.includes("phone screen") ||
    text.includes("call") ||
    text.includes("meet with") ||
    text.includes("next step")
  ) {
    return CATEGORIES.INTERVIEW;
  }

  if (
    text.includes("start date") ||
    text.includes("congratulations") 
  ) {
    return CATEGORIES.OFFER;
  }
  
  return CATEGORIES.OTHER;
}

/**
 * Extract header value from email headers
 */
function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  if (!headers) return "";
  const header = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value || "";
}

/**
 * Fetch job-related emails from Gmail (fetches entire threads)
 */
export async function fetchJobEmails(
  gmail: gmail_v1.Gmail,
  options: {
    startDate?: string;
    endDate?: string;
    pageToken?: string;
  } = {}
): Promise<{ emails: JobEmail[]; nextPageToken?: string }> {
  const { startDate, endDate, pageToken } = options;

  // Search for job-related emails with date range
  const query = buildJobSearchQuery(startDate, endDate);

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 500, // Higher limit since we're filtering by date range
    pageToken,
  });

  const messages = listResponse.data.messages || [];
  
  // Collect unique threadIds from matching messages
  const threadIds = new Set<string>();
  for (const message of messages) {
    if (message.threadId) {
      threadIds.add(message.threadId);
    }
  }

  const emails: JobEmail[] = [];
  const processedEmailIds = new Set<string>(); // Track processed emails to avoid duplicates

  // Fetch full thread for each unique threadId
  for (const threadId of threadIds) {
    const threadResponse = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const threadMessages = threadResponse.data.messages || [];
    
    // Process each message in the thread
    for (const msg of threadMessages) {
      if (!msg.id) continue;
      
      // Skip if already processed
      if (processedEmailIds.has(msg.id)) continue;

      const headers = msg.payload?.headers;
      const subject = getHeader(headers, "Subject");
      const from = getHeader(headers, "From");
      const date = getHeader(headers, "Date");
      const snippet = msg.snippet || "";
      const labelIds = msg.labelIds || [];
      const isCalendarInvite = hasCalendarInvite(msg.payload);
      
      const domain = from.slice(from.lastIndexOf("@")+1).split(">")[0]
      const domains = domain.split(".")
      const secondLevelDomain = domains[domains.length-2]

      const commonSecondLevelDomains = [
        "gmail",
        "smartrecruiters",
        "alexanderchapmanltd",
        "lever",
        "greenhouse",
        "indeed",
        "ashbyhq",
        "greenhouse-mail",
        "myworkday",
        "governmentjobs",
        "hiring",
        "gem"
      ]

      if (secondLevelDomain.length > 2 && !commonSecondLevelDomains.includes(secondLevelDomain)) {
        // Search for the job application email
        // or other emails related to the conversation 
        // from other threads or email addresses
        // and add them to this thread, even if they are actually 
        // from another thread
        const relatedResponse = await gmail.users.messages.list({
          userId: "me",
          q: buildJobApplicationQuery(secondLevelDomain, startDate, endDate),
          maxResults: 10, // only looking for one or two emails 
        });

        const relatedMessages = relatedResponse.data.messages || [];
        
        for (const relatedMsg of relatedMessages) {
          if (!relatedMsg.id || relatedMsg.id === msg.id) continue;
          
          // If already processed, update its threadId to group with current conversation
          if (processedEmailIds.has(relatedMsg.id)) {
            const existingEmail = emails.find(e => e.id === relatedMsg.id);
            if (existingEmail) {
              existingEmail.threadId = threadId;
            }
            continue;
          }
          
          // Fetch the full message details
          const fullMsg = await gmail.users.messages.get({
            userId: "me",
            id: relatedMsg.id,
            format: "full",
          });
          
          const relatedHeaders = fullMsg.data.payload?.headers;
          const relatedSubject = getHeader(relatedHeaders, "Subject");
          const relatedFrom = getHeader(relatedHeaders, "From");
          const relatedDate = getHeader(relatedHeaders, "Date");
          const relatedSnippet = fullMsg.data.snippet || "";
          const relatedLabelIds = fullMsg.data.labelIds || [];
          const relatedIsCalendarInvite = hasCalendarInvite(fullMsg.data.payload);
          
          processedEmailIds.add(relatedMsg.id);
          emails.push({
            id: relatedMsg.id,
            threadId: threadId, // Associate with the current thread for grouping
            subject: relatedSubject,
            from: relatedFrom,
            date: relatedDate,
            snippet: relatedSnippet,
            labels: relatedLabelIds,
            category: categorizeEmail(relatedSubject, relatedSnippet, relatedFrom, relatedIsCalendarInvite),
          });
        }
      }

      processedEmailIds.add(msg.id);
      emails.push({
        id: msg.id,
        threadId: threadId,
        subject,
        from,
        date,
        snippet,
        labels: labelIds,
        category: categorizeEmail(subject, snippet, from, isCalendarInvite),
      });
    }
  }

  return {
    emails,
    nextPageToken: listResponse.data.nextPageToken || undefined,
  };
}


/**
 * Get email statistics by category
 */
export function getEmailStats(emails: JobEmail[]) {
  const stats: EmailStats = {
    total: emails.length,
    byCategory: {
      application: 0,
      interview: 0,
      offer: 0,
      rejection: 0,
      other: 0,
      opportunity: 0,
      conversation: 0,
    },
  };

  for (const email of emails) {
    stats.byCategory[email.category]++;
  }

  return stats;
}
