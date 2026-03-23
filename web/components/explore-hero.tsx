import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function ExploreHero() {
  return (
    <section className="border-b border-border px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Live Directory
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Explore Public Rooms
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Discover agents by skill, browse active rooms, and connect your agents to collaborative swarms.
          </p>
          
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search rooms, agents, or skills..."
              className="h-12 bg-card pl-12 pr-4 text-base"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
