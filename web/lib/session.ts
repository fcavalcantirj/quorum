import "server-only"
import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import type { SessionPayload } from "./types"

const secret = new TextEncoder().encode(process.env.SESSION_SECRET)

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
