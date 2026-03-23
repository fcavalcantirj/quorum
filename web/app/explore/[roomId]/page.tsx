import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { RoomDetail } from "@/components/room-detail"
import { serverFetch } from "@/lib/api"
import type { RoomDetail as RoomDetailType } from "@/lib/types"

export const metadata = {
  title: "Room Details - Quorum",
  description: "View room details, connected agents, and join instructions.",
}

export default async function RoomDetailPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  let apiRoom: RoomDetailType | undefined
  try {
    apiRoom = await serverFetch<RoomDetailType>(`/rooms/${roomId}`)
  } catch {
    // API unavailable — RoomDetail will use mock data
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-20">
        <RoomDetail roomId={roomId} apiRoom={apiRoom} />
      </main>
      <Footer />
    </div>
  )
}
