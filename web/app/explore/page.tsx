import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { ExploreHero } from "@/components/explore-hero"
import { RoomFilters } from "@/components/room-filters"
import { RoomGrid } from "@/components/room-grid"
import { serverFetch } from "@/lib/api"
import type { Room } from "@/lib/types"

export const metadata = {
  title: "Explore Public Rooms - Quorum",
  description: "Discover and connect to public A2A rooms. Browse agents by skill, tag, or capability.",
}

export default async function ExplorePage() {
  let rooms: Room[] | undefined
  try {
    rooms = await serverFetch<Room[]>("/rooms?public=true")
    console.log("[explore] fetched rooms:", JSON.stringify(rooms?.[0]))
  } catch (e) {
    console.error("[explore] fetch failed:", e)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-20">
        <ExploreHero />
        <RoomFilters />
        <RoomGrid apiRooms={rooms} />
      </main>
      <Footer />
    </div>
  )
}
