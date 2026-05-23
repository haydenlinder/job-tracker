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
function buildJobSearchQuery(): string {
  // Search in subject or body for job-related terms
  const keywordQueries = JOB_SEARCH_KEYWORDS.map((kw) => `"${kw}"`).join(" OR ");
  return `(${keywordQueries})`;
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
  isCalendarInvite: boolean = false
): JobEmail["category"] {
  // Calendar invites are automatically categorized as interviews
  if (isCalendarInvite) {
    return CATEGORIES.INTERVIEW;
  }

  const text = `${subject} ${snippet}`.toLowerCase();

  if (
    text.includes("opportunity")
  ) {
    return CATEGORIES.OPPORTUNITY;
  }
  if (
    text.includes("offer") ||
    text.includes("compensation") ||
    text.includes("salary") ||
    text.includes("start date")
  ) {
    return CATEGORIES.OFFER;
  }

  if (
    text.includes("interview") ||
    text.includes("phone screen") ||
    text.includes("call") ||
    text.includes("meet with") ||
    text.includes("opportunity")

  ) {
    return CATEGORIES.INTERVIEW;
  }

  if (
    text.includes("regret") ||
    text.includes("unfortunately") ||
    text.includes("not moving forward") ||
    text.includes("decided not to")
  ) {
    return CATEGORIES.REJECTION;
  }

  if (
    text.includes("application") ||
    text.includes("applied") ||
    text.includes("thank you for")
  ) {
    return CATEGORIES.APPLICATION;
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
 * Fetch job-related emails from Gmail
 */
export async function fetchJobEmails(
  gmail: gmail_v1.Gmail,
  options: {
    maxResults?: number;
    pageToken?: string;
  } = {}
): Promise<{ emails: JobEmail[]; nextPageToken?: string }> {
  const { maxResults = 50, pageToken } = options;

  // Search for job-related emails
  const query = buildJobSearchQuery();

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
    pageToken,
  });

  const messages = listResponse.data.messages || [];
  const emails: JobEmail[] = [];

  // Fetch full details for each message
  for (const message of messages) {
    if (!message.id) continue;

    const msgResponse = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "full",
    });

    const headers = msgResponse.data.payload?.headers;
    const subject = getHeader(headers, "Subject");
    const from = getHeader(headers, "From");
    const date = getHeader(headers, "Date");
    const snippet = msgResponse.data.snippet || "";
    const labelIds = msgResponse.data.labelIds || [];
    const isCalendarInvite = hasCalendarInvite(msgResponse.data.payload);

    emails.push({
      id: message.id,
      threadId: message.threadId || "",
      subject,
      from,
      date,
      snippet,
      labels: labelIds,
      category: categorizeEmail(subject, snippet, isCalendarInvite),
    });
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
