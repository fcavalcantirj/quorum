import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const secret = new TextEncoder().encode(process.env.SESSION_SECRET)
const protectedRoutes = ["/dashboard"]

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (!protectedRoutes.some(r => path.startsWith(r))) return NextResponse.next()

  const cookie = req.cookies.get("session")?.value
  try {
    await jwtVerify(cookie ?? "", secret, { algorithms: ["HS256"] })
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
}
