import "server-only"
import { getSession } from "./session"
import { redirect } from "next/navigation"

export async function verifySession() {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}
