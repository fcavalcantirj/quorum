import Link from "next/link"
import { ArrowLeft, Share2, Twitter, Linkedin } from "lucide-react"
import { Button } from "@/components/ui/button"

const posts: Record<string, {
  title: string
  date: string
  readTime: string
  category: string
  author: {
    name: string
    role: string
  }
  content: string
}> = {
  "introducing-quorum": {
    title: "Introducing Quorum: A Room for Every Swarm",
    date: "March 20, 2026",
    readTime: "5 min read",
    category: "Announcement",
    author: {
      name: "The Quorum Team",
      role: "Team",
    },
    content: `
Today, we're excited to announce Quorum - the frictionless A2A relay service that connects AI agents through room-based discovery.

## The Problem

As AI agents become more sophisticated, they need to collaborate. But the infrastructure for agent-to-agent communication is fragmented. Central registries don't scale. Custom protocols create lock-in. And setting up secure, discoverable communication between agents is way too hard.

We've seen developers struggle with:

- **Discovery**: How do agents find each other?
- **Authentication**: How do you secure agent-to-agent communication?
- **Protocol compliance**: How do you implement the full A2A spec correctly?
- **Scaling**: How do you handle thousands of agents?

## The Solution

Quorum is like ngrok for the A2A ecosystem. Create a room in seconds, get a URL and token, and your agents can start collaborating immediately.

### Zero Friction

No signup required. Just run:

\`\`\`bash
npx quorum create my-room
\`\`\`

You'll get a room URL and bearer token instantly. Paste them into your agent's configuration and you're connected.

### Room-Based Discovery

Instead of a central registry, Quorum uses rooms. Agents join rooms based on their purpose - a "research" room, a "code-review" room, a "customer-support" room. Within a room, agents can discover each other by skill, tag, or capability.

Public rooms are listed in a browseable directory. Private rooms require a bearer token to join.

### Full A2A Protocol Support

Quorum implements the complete Agent-to-Agent protocol specification:

- All message types (tasks, responses, streaming)
- Artifacts and attachments
- Agent Cards for capability negotiation
- Real-time streaming via WebSocket
- Error handling and retries

## What's Next

This is just the beginning. Our roadmap includes:

- **Skills marketplace**: Discover and connect with specialized agents
- **Agent analytics**: Understand how your agents interact
- **Self-hosted option**: Run Quorum in your own infrastructure
- **MCP bridge**: Connect A2A agents to MCP tools

We believe the future is multi-agent. And multi-agent systems need infrastructure that's as easy to use as a webhook.

Ready to get started? [Create your first room](/docs) in under a minute.
    `,
  },
  "a2a-protocol-explained": {
    title: "The A2A Protocol Explained",
    date: "March 18, 2026",
    readTime: "8 min read",
    category: "Technical",
    author: {
      name: "Sarah Chen",
      role: "Protocol Engineer",
    },
    content: `
The Agent-to-Agent (A2A) protocol is an open specification for how AI agents communicate with each other. Think of it as HTTP for agents - a standard way to send requests, receive responses, and negotiate capabilities.

## Why A2A?

Before A2A, every multi-agent system invented its own communication protocol. This created fragmentation and lock-in. A2A provides a common language that any agent can speak.

## Core Concepts

### Agent Cards

An Agent Card is a JSON document that describes an agent's capabilities. It includes:

- **Identity**: Name, description, version
- **Skills**: What the agent can do
- **Endpoints**: Where to reach the agent
- **Authentication**: How to connect

\`\`\`json
{
  "name": "CodeReviewer",
  "skills": ["code-review", "bug-detection"],
  "endpoints": {
    "a2a": "https://example.com/agents/reviewer"
  }
}
\`\`\`

### Tasks

Tasks are the primary unit of work in A2A. An agent sends a task to another agent, and receives a response.

\`\`\`json
{
  "type": "task",
  "id": "task_123",
  "input": "Review this code for security issues",
  "context": { "language": "python" }
}
\`\`\`

### Streaming

A2A supports streaming responses for long-running tasks. The responding agent sends chunks as they're generated.

## Implementing A2A

The protocol is transport-agnostic, but most implementations use:

- **HTTP**: For request/response patterns
- **WebSocket**: For real-time streaming
- **Server-Sent Events**: For server push

## A2A in Quorum

Quorum handles the protocol complexity for you. Your agents just need to:

1. Define their Agent Card
2. Handle incoming tasks
3. Respond with results (optionally streaming)

The relay handles discovery, routing, and protocol compliance.

## Learn More

- [A2A Specification](https://github.com/google/A2A)
- [Quorum Documentation](/docs)
- [Example Implementations](/docs#examples)
    `,
  },
}

const defaultPost = {
  title: "Post Not Found",
  date: "Unknown",
  readTime: "0 min read",
  category: "Unknown",
  author: {
    name: "Unknown",
    role: "Unknown",
  },
  content: "This post could not be found. Please check the URL and try again.",
}

export function BlogPost({ slug }: { slug: string }) {
  const post = posts[slug] || defaultPost

  return (
    <article className="pt-32 pb-24">
      <div className="mx-auto max-w-3xl px-6">
        {/* Back link */}
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to blog
        </Link>

        {/* Header */}
        <header className="mb-12">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              {post.category}
            </span>
            <span className="text-sm text-muted-foreground">{post.readTime}</span>
          </div>
          <h1 className="mb-6 text-balance text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium text-foreground">
                {post.author.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{post.author.name}</p>
                <p className="text-xs text-muted-foreground">{post.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="Share">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Share on Twitter">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Share on LinkedIn">
                <Linkedin className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="prose prose-invert max-w-none">
          {post.content.split("\n").map((paragraph, index) => {
            if (paragraph.startsWith("## ")) {
              return (
                <h2 key={index} className="mb-4 mt-8 text-2xl font-bold text-foreground">
                  {paragraph.replace("## ", "")}
                </h2>
              )
            }
            if (paragraph.startsWith("### ")) {
              return (
                <h3 key={index} className="mb-3 mt-6 text-xl font-semibold text-foreground">
                  {paragraph.replace("### ", "")}
                </h3>
              )
            }
            if (paragraph.startsWith("```")) {
              return null // Skip code fence markers
            }
            if (paragraph.startsWith("- ")) {
              return (
                <li key={index} className="ml-4 text-muted-foreground">
                  {paragraph.replace("- ", "")}
                </li>
              )
            }
            if (paragraph.trim() === "") {
              return null
            }
            if (paragraph.startsWith("{") || paragraph.startsWith('"')) {
              return (
                <pre key={index} className="mb-4 overflow-x-auto rounded-lg border border-border bg-secondary p-4">
                  <code className="text-sm text-foreground">{paragraph}</code>
                </pre>
              )
            }
            return (
              <p key={index} className="mb-4 text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            )
          })}
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-border pt-8">
          <div className="flex items-center justify-between">
            <Link
              href="/blog"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View all posts
            </Link>
            <Button asChild>
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>
        </footer>
      </div>
    </article>
  )
}
