import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient, fetchJobEmails, getEmailStats } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("gmail_access_token")?.value;
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Not authenticated. Please connect your Gmail account." },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const maxResults = parseInt(searchParams.get("maxResults") || "50", 10);
    const pageToken = searchParams.get("pageToken") || undefined;

    const gmail = getGmailClient(accessToken, refreshToken);
    const { emails, nextPageToken } = await fetchJobEmails(gmail, {
      maxResults,
      pageToken,
    });

    const stats = getEmailStats(emails);

    return NextResponse.json({
      emails,
      stats,
      nextPageToken,
    });
  } catch (err: unknown) {
    console.error("Gmail API error:", err);

    // Check if token expired
    if (
      err instanceof Error &&
      (err.message.includes("invalid_grant") ||
        err.message.includes("Token has been expired"))
    ) {
      return NextResponse.json(
        { error: "Token expired. Please reconnect your Gmail account." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
