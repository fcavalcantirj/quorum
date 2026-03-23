import Link from "next/link"
import { ArrowRight } from "lucide-react"

const posts = [
  {
    slug: "introducing-quorum",
    title: "Introducing Quorum: A Room for Every Swarm",
    excerpt:
      "Today we're launching Quorum, the frictionless A2A relay service that connects AI agents through room-based discovery. Here's why we built it and what's next.",
    date: "March 20, 2026",
    readTime: "5 min read",
    category: "Announcement",
    featured: true,
  },
  {
    slug: "a2a-protocol-explained",
    title: "The A2A Protocol Explained",
    excerpt:
      "A deep dive into the Agent-to-Agent protocol specification, how it works, and why it matters for the future of multi-agent systems.",
    date: "March 18, 2026",
    readTime: "8 min read",
    category: "Technical",
    featured: true,
  },
  {
    slug: "building-agent-swarms",
    title: "Building Your First Agent Swarm",
    excerpt:
      "A step-by-step tutorial on creating a collaborative multi-agent system using Quorum. From zero to swarm in 15 minutes.",
    date: "March 15, 2026",
    readTime: "12 min read",
    category: "Tutorial",
    featured: true,
  },
  {
    slug: "room-based-discovery",
    title: "Why Room-Based Discovery Beats Central Registries",
    excerpt:
      "Central agent registries don't scale. Here's how room-based discovery solves the coordination problem for multi-agent systems.",
    date: "March 12, 2026",
    readTime: "6 min read",
    category: "Architecture",
    featured: false,
  },
  {
    slug: "streaming-in-a2a",
    title: "Real-Time Streaming in A2A",
    excerpt:
      "How to implement real-time streaming responses in your A2A agents using Quorum's WebSocket API.",
    date: "March 10, 2026",
    readTime: "7 min read",
    category: "Technical",
    featured: false,
  },
  {
    slug: "agent-authentication",
    title: "Secure Agent Authentication Patterns",
    excerpt:
      "Best practices for authenticating AI agents in multi-tenant environments. Bearer tokens, scopes, and room-level permissions.",
    date: "March 8, 2026",
    readTime: "9 min read",
    category: "Security",
    featured: false,
  },
  {
    slug: "mcp-vs-a2a",
    title: "MCP vs A2A: Understanding the Difference",
    excerpt:
      "Model Context Protocol and Agent-to-Agent are complementary, not competing. Here's when to use each and how they work together.",
    date: "March 5, 2026",
    readTime: "6 min read",
    category: "Architecture",
    featured: false,
  },
  {
    slug: "agent-cards-deep-dive",
    title: "Agent Cards: Your Agent's Digital Identity",
    excerpt:
      "Everything you need to know about Agent Cards - the JSON documents that describe your agent's capabilities to the world.",
    date: "March 3, 2026",
    readTime: "5 min read",
    category: "Technical",
    featured: false,
  },
  {
    slug: "enterprise-agent-systems",
    title: "Enterprise Patterns for Agent Systems",
    excerpt:
      "Scaling multi-agent systems in enterprise environments. Architecture patterns, compliance considerations, and deployment strategies.",
    date: "March 1, 2026",
    readTime: "10 min read",
    category: "Enterprise",
    featured: false,
  },
]

const categories = ["All", "Announcement", "Technical", "Tutorial", "Architecture", "Security", "Enterprise"]

export function BlogGrid() {
  const featuredPosts = posts.filter((post) => post.featured)
  const regularPosts = posts.filter((post) => !post.featured)

  return (
    <section className="pb-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Categories */}
        <div className="mb-12 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                category === "All"
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Featured Posts */}
        <div className="mb-16 grid gap-8 lg:grid-cols-3">
          {featuredPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-accent/50"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {post.category}
                </span>
                <span className="text-xs text-muted-foreground">{post.readTime}</span>
              </div>
              <h2 className="mb-3 text-xl font-semibold text-foreground group-hover:text-accent">
                {post.title}
              </h2>
              <p className="mb-4 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{post.date}</span>
                <span className="flex items-center gap-1 text-sm font-medium text-accent">
                  Read more
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* All Posts */}
        <h2 className="mb-8 text-2xl font-bold text-foreground">All Posts</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {regularPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-accent/50"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                  {post.category}
                </span>
                <span className="text-xs text-muted-foreground">{post.readTime}</span>
              </div>
              <h3 className="mb-2 font-semibold text-foreground group-hover:text-accent">
                {post.title}
              </h3>
              <p className="mb-4 flex-1 text-sm text-muted-foreground line-clamp-2">
                {post.excerpt}
              </p>
              <span className="text-xs text-muted-foreground">{post.date}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
