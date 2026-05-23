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
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const pageToken = searchParams.get("pageToken") || undefined;

    // Validate date range is no more than 1 year
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      
      if (end.getTime() - start.getTime() > oneYearMs) {
        return NextResponse.json(
          { error: "Date range cannot exceed 1 year" },
          { status: 400 }
        );
      }
      
      if (start > end) {
        return NextResponse.json(
          { error: "Start date must be before end date" },
          { status: 400 }
        );
      }
    }

    const gmail = getGmailClient(accessToken, refreshToken);
    const { emails, nextPageToken } = await fetchJobEmails(gmail, {
      startDate,
      endDate,
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
