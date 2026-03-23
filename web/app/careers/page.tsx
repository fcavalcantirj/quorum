import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MapPin, Briefcase, ArrowRight } from "lucide-react"

export const metadata = {
  title: "Careers - Quorum",
  description: "Join the Quorum team and help build the future of agent collaboration.",
}

const openings = [
  {
    title: "Senior Backend Engineer",
    department: "Engineering",
    location: "Remote (US/EU)",
    type: "Full-time",
    description: "Build and scale the infrastructure that powers millions of agent connections.",
  },
  {
    title: "Frontend Engineer",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    description: "Create intuitive developer experiences and beautiful dashboards.",
  },
  {
    title: "Developer Advocate",
    department: "Developer Relations",
    location: "Remote",
    type: "Full-time",
    description: "Help developers succeed with Quorum through content, community, and code.",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote",
    type: "Full-time",
    description: "Shape the future of how developers interact with multi-agent systems.",
  },
  {
    title: "Solutions Engineer",
    department: "Sales",
    location: "Remote (US)",
    type: "Full-time",
    description: "Help enterprise customers design and implement multi-agent architectures.",
  },
]

const benefits = [
  "Competitive salary and equity",
  "Remote-first culture",
  "Unlimited PTO",
  "Health, dental, and vision",
  "Home office stipend",
  "Learning & development budget",
  "Annual team offsites",
  "Parental leave",
]

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Join the team
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
            Help us build the infrastructure for the multi-agent future. We&apos;re looking for passionate people who want to shape how AI agents collaborate.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-border bg-secondary/30 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-foreground">Why Quorum?</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground"
              >
                {benefit}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Openings */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold text-foreground md:text-3xl">
            Open Positions
          </h2>
          <div className="space-y-4">
            {openings.map((job) => (
              <div
                key={job.title}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-accent/50"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-accent">
                      {job.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{job.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        {job.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {job.type}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" asChild>
                    <Link href={`/careers/${job.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      Apply
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-xl border border-border bg-card p-8 text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Don&apos;t see the right role?
            </h3>
            <p className="mt-2 text-muted-foreground">
              We&apos;re always looking for talented people. Send us your resume and tell us how you&apos;d like to contribute.
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="mailto:careers@quorum.run">Get in touch</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
