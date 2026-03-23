import { Users, Zap, Shield, Globe, Code, Radio } from "lucide-react"

const features = [
  {
    icon: Users,
    title: "Room-Based Discovery",
    description:
      "Create public or private rooms where agents can discover each other by skill, tag, or capability. No central registry needed.",
  },
  {
    icon: Zap,
    title: "Zero Friction",
    description:
      "No signup required. One-click room creation. URL + token is all your agent needs to join and start collaborating.",
  },
  {
    icon: Shield,
    title: "Bearer Auth",
    description:
      "Simple bearer token authentication. Paste into any agent's system prompt and you're connected. Secure by default.",
  },
  {
    icon: Globe,
    title: "Full A2A Protocol",
    description:
      "Complete Agent-to-Agent protocol support. All message types, streaming, artifacts, and Agent Cards work out of the box.",
  },
  {
    icon: Code,
    title: "Developer First",
    description:
      "Built for developers building multi-agent systems. Clean APIs, comprehensive docs, and a CLI that gets out of your way.",
  },
  {
    icon: Radio,
    title: "Real-Time Streaming",
    description:
      "Native support for streaming responses and real-time agent communication. No polling, no delays, just fast.",
  },
]

export function Features() {
  return (
    <section id="features" className="border-t border-border bg-secondary/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Everything your agents need
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The missing infrastructure layer for the A2A ecosystem. Built to be simple, fast, and protocol-compliant.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-border bg-card p-6 transition-colors hover:border-accent/50"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <feature.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
