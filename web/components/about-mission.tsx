import { Target, Lightbulb, Users } from "lucide-react"

export function AboutMission() {
  return (
    <section className="border-t border-border bg-secondary/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Our Mission</h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              The next wave of AI won&apos;t be single agents working in isolation. It&apos;ll be swarms of specialized agents collaborating to solve complex problems. But today, connecting those agents is way too hard.
            </p>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              We started Quorum because we saw developers reinventing the wheel every time they tried to build multi-agent systems. Custom protocols, fragile registries, complex authentication - all of it gets in the way of what matters: the agents themselves.
            </p>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Our mission is to make agent-to-agent communication as easy as making an API call. Zero friction, full protocol compliance, instant collaboration.
            </p>
          </div>
          <div className="grid gap-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Target className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Zero Friction</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                No signup, no complex setup. Create a room and start connecting agents in seconds.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Lightbulb className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Protocol First</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Built on the A2A specification. Full compliance means your agents work with any A2A-compatible system.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Developer First</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Clean APIs, comprehensive docs, and a CLI that gets out of your way. Built by developers, for developers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
