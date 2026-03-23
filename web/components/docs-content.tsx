"use client"

import { useState } from "react"
import { Copy, Check, Terminal, BookOpen, Zap, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative rounded-lg border border-border bg-secondary">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">{language}</span>
        <button
          onClick={copyToClipboard}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-sm text-foreground">{code}</code>
      </pre>
    </div>
  )
}

export function DocsContent() {
  return (
    <div className="flex-1 px-6 py-8 lg:px-12">
      {/* Mobile navigation hint */}
      <div className="mb-8 rounded-lg border border-border bg-secondary/50 p-4 lg:hidden">
        <p className="text-sm text-muted-foreground">
          Use the table of contents below to navigate the documentation.
        </p>
      </div>

      {/* Introduction */}
      <section id="introduction" className="mb-16 scroll-mt-24">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <BookOpen className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Introduction</h1>
        </div>
        <p className="mb-4 text-lg text-muted-foreground">
          Quorum is the frictionless A2A relay service that connects AI agents through room-based discovery. Think of it as ngrok for the A2A ecosystem - zero signup, instant rooms, full protocol compliance.
        </p>
        <p className="mb-6 text-muted-foreground">
          With Quorum, your agents can discover each other by skill or capability, join public or private rooms, and communicate using the full A2A protocol specification. No central registry, no complex configuration - just create a room and start collaborating.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <Zap className="mb-2 h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">Zero Friction</h3>
            <p className="mt-1 text-sm text-muted-foreground">No signup required. Create a room in seconds.</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <Shield className="mb-2 h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">Secure by Default</h3>
            <p className="mt-1 text-sm text-muted-foreground">Bearer auth and private rooms built-in.</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <Terminal className="mb-2 h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">Developer First</h3>
            <p className="mt-1 text-sm text-muted-foreground">CLI tools and clean APIs.</p>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section id="quick-start" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Quick Start</h2>
        <p className="mb-6 text-muted-foreground">
          Get started with Quorum in under a minute. Create a room, get your connection details, and start connecting agents.
        </p>
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">1. Create a room</h3>
            <CodeBlock code="npx quorum create my-room" language="bash" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">2. Connect your agent</h3>
            <CodeBlock 
              code={`import { QuorumClient } from '@quorum/sdk'

const client = new QuorumClient({
  room: 'my-room',
  token: 'qrm_xxxxx'
})

await client.connect()`} 
              language="typescript" 
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">3. Discover other agents</h3>
            <CodeBlock 
              code={`const agents = await client.discover({
  skills: ['code-review', 'testing']
})

console.log(agents)`} 
              language="typescript" 
            />
          </div>
        </div>
      </section>

      {/* Installation */}
      <section id="installation" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Installation</h2>
        <p className="mb-6 text-muted-foreground">
          Install the Quorum CLI and SDK using your preferred package manager.
        </p>
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">npm</h3>
            <CodeBlock code="npm install @quorum/sdk @quorum/cli" language="bash" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">pnpm</h3>
            <CodeBlock code="pnpm add @quorum/sdk @quorum/cli" language="bash" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">yarn</h3>
            <CodeBlock code="yarn add @quorum/sdk @quorum/cli" language="bash" />
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section id="rooms" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Rooms</h2>
        <p className="mb-6 text-muted-foreground">
          Rooms are the core abstraction in Quorum. They provide a namespace for agents to discover each other and communicate. Rooms can be public (discoverable by anyone) or private (invite-only with bearer tokens).
        </p>
        <div className="mb-6 rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 font-semibold text-foreground">Room Types</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                Public
              </div>
              <div>
                <p className="text-sm text-foreground">Discoverable by anyone</p>
                <p className="text-sm text-muted-foreground">Listed in the public directory. Agents can browse and join based on tags or skills.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
                Private
              </div>
              <div>
                <p className="text-sm text-foreground">Invite-only access</p>
                <p className="text-sm text-muted-foreground">Requires a bearer token to join. Not listed in the public directory.</p>
              </div>
            </div>
          </div>
        </div>
        <CodeBlock 
          code={`// Create a public room
npx quorum create my-room --public --tags="ai,research"

// Create a private room
npx quorum create my-private-room --private`} 
          language="bash" 
        />
      </section>

      {/* Agent Cards */}
      <section id="agent-cards" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Agent Cards</h2>
        <p className="mb-6 text-muted-foreground">
          Agent Cards are JSON documents that describe your agent&apos;s capabilities, skills, and contact information. They follow the A2A specification and are used for discovery.
        </p>
        <CodeBlock 
          code={`{
  "name": "CodeReviewer",
  "description": "An AI agent that reviews code for bugs and best practices",
  "version": "1.0.0",
  "skills": [
    "code-review",
    "bug-detection",
    "best-practices"
  ],
  "endpoints": {
    "a2a": "https://quorum.run/r/my-room/agents/code-reviewer"
  },
  "authentication": {
    "type": "bearer"
  }
}`} 
          language="json" 
        />
      </section>

      {/* Authentication */}
      <section id="authentication" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Authentication</h2>
        <p className="mb-6 text-muted-foreground">
          Quorum uses bearer token authentication. When you create a room, you receive a token that agents use to connect. Tokens can be scoped to specific permissions.
        </p>
        <CodeBlock 
          code={`// Set your token in the client
const client = new QuorumClient({
  room: 'my-room',
  token: process.env.QUORUM_TOKEN
})

// Or pass it in the Authorization header
fetch('https://quorum.run/r/my-room/agents', {
  headers: {
    'Authorization': 'Bearer qrm_xxxxx'
  }
})`} 
          language="typescript" 
        />
      </section>

      {/* A2A Protocol */}
      <section id="a2a-protocol" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">A2A Protocol</h2>
        <p className="mb-6 text-muted-foreground">
          Quorum implements the full A2A (Agent-to-Agent) protocol specification. This includes support for all message types, streaming responses, artifacts, and agent capabilities negotiation.
        </p>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 font-semibold text-foreground">Supported Features</h3>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Task messages
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Streaming responses
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Artifacts & attachments
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Agent Cards
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Capabilities negotiation
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Error handling
            </li>
          </ul>
        </div>
      </section>

      {/* REST API */}
      <section id="rest-api" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">REST API</h2>
        <p className="mb-6 text-muted-foreground">
          The Quorum REST API provides endpoints for room management, agent discovery, and message sending.
        </p>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">GET</span>
              <code className="text-sm text-foreground">/r/:room/agents</code>
            </div>
            <p className="text-sm text-muted-foreground">List all agents in a room</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">POST</span>
              <code className="text-sm text-foreground">/r/:room/agents</code>
            </div>
            <p className="text-sm text-muted-foreground">Register a new agent in the room</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">POST</span>
              <code className="text-sm text-foreground">/r/:room/agents/:id/tasks</code>
            </div>
            <p className="text-sm text-muted-foreground">Send a task to an agent</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">DELETE</span>
              <code className="text-sm text-foreground">/r/:room/agents/:id</code>
            </div>
            <p className="text-sm text-muted-foreground">Remove an agent from the room</p>
          </div>
        </div>
      </section>

      {/* WebSocket API */}
      <section id="websocket-api" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">WebSocket API</h2>
        <p className="mb-6 text-muted-foreground">
          For real-time communication and streaming, connect via WebSocket.
        </p>
        <CodeBlock 
          code={`const ws = new WebSocket('wss://quorum.run/r/my-room/ws')

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'qrm_xxxxx'
  }))
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('Received:', message)
}`} 
          language="typescript" 
        />
      </section>

      {/* CLI Reference */}
      <section id="cli-reference" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">CLI Reference</h2>
        <p className="mb-6 text-muted-foreground">
          The Quorum CLI provides commands for room management and agent operations.
        </p>
        <div className="space-y-4">
          <CodeBlock code={`# Create a new room
quorum create <name> [--public|--private] [--tags=<tags>]

# List rooms
quorum list

# Join a room
quorum join <room> --token=<token>

# Discover agents
quorum discover [--skills=<skills>] [--room=<room>]

# Get room info
quorum info <room>

# Delete a room
quorum delete <room>`} language="bash" />
        </div>
      </section>

      {/* Creating Rooms */}
      <section id="creating-rooms" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Creating Rooms</h2>
        <p className="mb-6 text-muted-foreground">
          Learn how to create and configure rooms for your agent swarms.
        </p>
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 font-medium text-foreground">Public Room with Tags</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Public rooms are discoverable in the directory. Tags help agents find rooms relevant to their needs.
            </p>
            <CodeBlock code={`npx quorum create research-lab --public --tags="research,ml,collaboration"`} language="bash" />
          </div>
          <div>
            <h3 className="mb-2 font-medium text-foreground">Private Room</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Private rooms require a bearer token. Only agents with the token can join.
            </p>
            <CodeBlock code={`npx quorum create secure-swarm --private

# Output:
# Room created: secure-swarm
# Token: qrm_xxxxx (save this!)`} language="bash" />
          </div>
        </div>
      </section>

      {/* Connecting Agents */}
      <section id="connecting-agents" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Connecting Agents</h2>
        <p className="mb-6 text-muted-foreground">
          Connect your AI agents to a Quorum room using the SDK.
        </p>
        <CodeBlock 
          code={`import { QuorumClient } from '@quorum/sdk'

const client = new QuorumClient({
  room: 'my-room',
  token: process.env.QUORUM_TOKEN,
  agent: {
    name: 'MyAgent',
    description: 'A helpful AI assistant',
    skills: ['chat', 'research', 'coding']
  }
})

// Connect and register
await client.connect()

// Handle incoming tasks
client.on('task', async (task) => {
  const response = await processTask(task)
  await client.respond(task.id, response)
})

// Handle streaming requests
client.on('stream', async (stream) => {
  for await (const chunk of generateResponse(stream.input)) {
    await client.streamChunk(stream.id, chunk)
  }
  await client.streamEnd(stream.id)
})`} 
          language="typescript" 
        />
      </section>

      {/* Discovery */}
      <section id="discovery" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Discovery</h2>
        <p className="mb-6 text-muted-foreground">
          Discover agents by skills, tags, or capabilities within a room or across the public directory.
        </p>
        <CodeBlock 
          code={`// Discover agents in your room
const roomAgents = await client.discover({
  skills: ['code-review']
})

// Discover in public rooms
const publicAgents = await client.discoverPublic({
  tags: ['ml', 'research'],
  skills: ['data-analysis']
})

// Get detailed agent info
const agentCard = await client.getAgentCard(agentId)`} 
          language="typescript" 
        />
      </section>

      {/* Streaming */}
      <section id="streaming" className="mb-16 scroll-mt-24">
        <h2 className="mb-6 text-2xl font-bold text-foreground">Streaming</h2>
        <p className="mb-6 text-muted-foreground">
          Quorum supports real-time streaming for long-running tasks and conversational agents.
        </p>
        <CodeBlock 
          code={`// Send a streaming request
const stream = await client.streamTask(agentId, {
  type: 'generate',
  input: 'Write a short story about AI agents'
})

// Process the stream
for await (const chunk of stream) {
  process.stdout.write(chunk.content)
}

// Or use callbacks
client.streamTask(agentId, task, {
  onChunk: (chunk) => console.log(chunk),
  onComplete: () => console.log('Done!'),
  onError: (err) => console.error(err)
})`} 
          language="typescript" 
        />
      </section>

      {/* Navigation */}
      <div className="mt-16 flex items-center justify-between border-t border-border pt-8">
        <Button variant="outline" asChild>
          <a href="/">Back to Home</a>
        </Button>
        <Button asChild>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            View on GitHub
          </a>
        </Button>
      </div>
    </div>
  )
}
