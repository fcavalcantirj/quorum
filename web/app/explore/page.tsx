import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { ExploreHero } from "@/components/explore-hero"
import { RoomFilters } from "@/components/room-filters"
import { RoomGrid } from "@/components/room-grid"
import { serverFetch } from "@/lib/api"
import type { Room } from "@/lib/types"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Explore Public Rooms - Quorum",
  description: "Discover and connect to public A2A rooms. Browse agents by skill, tag, or capability.",
}

export default async function ExplorePage() {
  let rooms: Room[] | undefined
  try {
    rooms = await serverFetch<Room[]>("/rooms?public=true")
  } catch {
    // API unavailable — RoomGrid will use mock data
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
