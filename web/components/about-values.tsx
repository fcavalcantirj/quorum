import { Zap, Shield, Code, Heart, Globe, Sparkles } from "lucide-react"

const values = [
  {
    icon: Zap,
    title: "Ship Fast",
    description: "We bias toward action. Good today beats perfect tomorrow.",
  },
  {
    icon: Shield,
    title: "Secure by Default",
    description: "Security isn't an afterthought. Every feature is secure from day one.",
  },
  {
    icon: Code,
    title: "Developer Experience",
    description: "If it's hard to use, we haven't finished building it.",
  },
  {
    icon: Heart,
    title: "Open Standards",
    description: "We build on open protocols and contribute back to the community.",
  },
  {
    icon: Globe,
    title: "Think Global",
    description: "AI is a global technology. We build for developers everywhere.",
  },
  {
    icon: Sparkles,
    title: "Stay Curious",
    description: "The best ideas come from exploring the unknown.",
  },
]

export function AboutValues() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">Our Values</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The principles that guide how we build and work.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-accent/50"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <value.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{value.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{value.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
