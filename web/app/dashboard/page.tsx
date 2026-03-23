import { cookies } from "next/headers"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { DashboardContent } from "@/components/dashboard-content"
import { verifySession } from "@/lib/dal"

export const metadata = {
  title: "Dashboard - Quorum",
  description: "Manage your rooms and connected agents.",
}

export default async function DashboardPage() {
  const session = await verifySession()
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || ""

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-20">
        <DashboardContent session={session} token={token} />
      </main>
      <Footer />
    </div>
  )
}
