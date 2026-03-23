import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.nextUrl))
  }

  try {
    const res = await fetch(`${process.env.API_URL}/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })

    if (!res.ok) {
      return NextResponse.redirect(new URL("/login?error=exchange_failed", req.nextUrl))
    }

    const { token, expiresAt } = await res.json()

    const cookieStore = await cookies()
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      expires: new Date(expiresAt),
      path: "/",
    })

    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  } catch {
    return NextResponse.redirect(new URL("/login?error=exchange_failed", req.nextUrl))
  }
}
