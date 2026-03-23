import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  // Go API redirects here with token and expiresAt as query params
  const token = req.nextUrl.searchParams.get("token")
  const expiresAt = req.nextUrl.searchParams.get("expiresAt")

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", req.nextUrl))
  }

  try {
    const cookieStore = await cookies()
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      expires: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      path: "/",
    })

    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  } catch {
    return NextResponse.redirect(new URL("/login?error=session_failed", req.nextUrl))
  }
}
