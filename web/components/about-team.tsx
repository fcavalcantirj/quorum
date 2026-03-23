import { Twitter, Github, Linkedin } from "lucide-react"
import Link from "next/link"

const team = [
  {
    name: "Alex Rivera",
    role: "Co-founder & CEO",
    bio: "Previously built developer tools at Vercel. Obsessed with removing friction from developer workflows.",
    avatar: "AR",
    twitter: "#",
    github: "#",
    linkedin: "#",
  },
  {
    name: "Sarah Chen",
    role: "Co-founder & CTO",
    bio: "Former protocol engineer at Protocol Labs. Led the design of multiple open standards for distributed systems.",
    avatar: "SC",
    twitter: "#",
    github: "#",
    linkedin: "#",
  },
  {
    name: "Marcus Johnson",
    role: "Head of Engineering",
    bio: "Built infrastructure at scale at AWS. Passionate about making complex systems feel simple.",
    avatar: "MJ",
    twitter: "#",
    github: "#",
    linkedin: "#",
  },
  {
    name: "Emily Zhang",
    role: "Head of Product",
    bio: "Former PM at Anthropic. Deeply curious about how AI agents will collaborate and evolve.",
    avatar: "EZ",
    twitter: "#",
    github: "#",
    linkedin: "#",
  },
  {
    name: "David Kim",
    role: "Developer Relations",
    bio: "Community builder and educator. Previously led DevRel at Supabase.",
    avatar: "DK",
    twitter: "#",
    github: "#",
    linkedin: "#",
  },
  {
    name: "Maria Santos",
    role: "Head of Design",
    bio: "Design systems expert from Figma. Believes great tools should be invisible.",
    avatar: "MS",
    twitter: "#",
    github: "#",
    linkedin: "#",
  },
]

export function AboutTeam() {
  return (
    <section className="border-t border-border bg-secondary/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">Meet the Team</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A small, focused team building the infrastructure for the multi-agent future.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {team.map((member) => (
            <div
              key={member.name}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-lg font-semibold text-accent">
                  {member.avatar}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{member.name}</h3>
                  <p className="text-sm text-accent">{member.role}</p>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{member.bio}</p>
              <div className="flex items-center gap-3">
                <Link
                  href={member.twitter}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`${member.name} on Twitter`}
                >
                  <Twitter className="h-4 w-4" />
                </Link>
                <Link
                  href={member.github}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`${member.name} on GitHub`}
                >
                  <Github className="h-4 w-4" />
                </Link>
                <Link
                  href={member.linkedin}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`${member.name} on LinkedIn`}
                >
                  <Linkedin className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-xl border border-border bg-card p-8 text-center">
          <h3 className="text-xl font-semibold text-foreground">Join Us</h3>
          <p className="mt-2 text-muted-foreground">
            We&apos;re hiring! Check out our open positions and help us build the future of agent collaboration.
          </p>
          <Link
            href="/careers"
            className="mt-4 inline-flex items-center gap-2 text-accent hover:underline"
          >
            View open positions
          </Link>
        </div>
      </div>
    </section>
  )
}
