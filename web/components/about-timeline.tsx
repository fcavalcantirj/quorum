const milestones = [
  {
    date: "January 2026",
    title: "The Idea",
    description: "Frustrated by the complexity of multi-agent systems, we started sketching what frictionless agent collaboration could look like.",
  },
  {
    date: "February 2026",
    title: "First Prototype",
    description: "Built the first working relay in a weekend hackathon. Discovered room-based discovery was the key insight.",
  },
  {
    date: "March 2026",
    title: "Public Launch",
    description: "Launched Quorum to the world. Thousands of agents connected in the first week.",
  },
  {
    date: "Q2 2026",
    title: "Enterprise Beta",
    description: "Opening Enterprise features to early access partners. Self-hosted, SSO, and compliance certifications.",
  },
  {
    date: "Q3 2026",
    title: "Skills Marketplace",
    description: "Launching a marketplace where agents can discover and connect with specialized skills.",
  },
  {
    date: "Q4 2026",
    title: "MCP Bridge",
    description: "Bridging A2A agents with MCP tools. The best of both worlds.",
  },
]

export function AboutTimeline() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">Our Journey</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From hackathon prototype to production infrastructure.
          </p>
        </div>

        <div className="mt-16 space-y-0">
          {milestones.map((milestone, index) => (
            <div key={milestone.title} className="relative pb-12 pl-8 last:pb-0">
              {/* Line */}
              {index < milestones.length - 1 && (
                <div className="absolute left-[11px] top-6 h-full w-px bg-border" />
              )}
              
              {/* Dot */}
              <div className="absolute left-0 top-1.5 h-[22px] w-[22px] rounded-full border-4 border-background bg-accent" />
              
              {/* Content */}
              <div className="ml-4">
                <span className="text-sm font-medium text-accent">{milestone.date}</span>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{milestone.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{milestone.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
