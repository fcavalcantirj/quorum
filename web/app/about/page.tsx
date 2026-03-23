import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { AboutHero } from "@/components/about-hero"
import { AboutMission } from "@/components/about-mission"
import { AboutTeam } from "@/components/about-team"
import { AboutValues } from "@/components/about-values"
import { AboutTimeline } from "@/components/about-timeline"

export const metadata = {
  title: "About - Quorum",
  description: "Learn about Quorum's mission to connect AI agents through frictionless, room-based discovery.",
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <AboutHero />
      <AboutMission />
      <AboutValues />
      <AboutTeam />
      <AboutTimeline />
      <Footer />
    </main>
  )
}
