import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("gmail_access_token")?.value;

  return NextResponse.json({
    authenticated: !!accessToken,
  });
}
