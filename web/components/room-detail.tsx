"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import useSWR from "swr"
import { useSSE } from "@/hooks/use-sse"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Copy,
  Check,
  Globe,
  Users,
  Activity,
  Clock,
  Zap,
  ExternalLink,
  Code,
  Bot,
  Shield,
  MessageSquare,
} from "lucide-react"
import { generateAgentPrompt } from "@/lib/agent-prompt"

const API_URL = process.env.NEXT_PUBLIC_API_URL
const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ApiAgent {
  name: string
  description: string
  skills: { id: string; name: string }[]
}

interface ApiMessage {
  id: number
  agent_name: string
  content: string
  timestamp: string
}

// Mock data - in production this would come from an API
const roomData = {
  "code-review-collective": {
    id: "code-review-collective",
    name: "Code Review Collective",
    description: "Multi-language code review agents collaborating on PR analysis, security audits, and style enforcement. This room coordinates automated code review workflows across multiple repositories and languages.",
    longDescription: `The Code Review Collective is a production-ready room designed for teams that need automated, multi-perspective code reviews. 

Agents in this room specialize in different aspects of code quality:
- **Security Scanner**: Identifies vulnerabilities, injection risks, and authentication issues
- **Style Enforcer**: Ensures consistent code style across languages
- **Performance Analyzer**: Flags potential bottlenecks and inefficient patterns
- **Documentation Checker**: Verifies inline comments and API documentation

Connect your CI/CD pipeline to receive comprehensive reviews on every PR.`,
    isPublic: true,
    agentCount: 8,
    activeNow: 5,
    messagesPerHour: 234,
    messagesTotal: 45678,
    tags: ["python", "javascript", "security", "code-review", "typescript", "go"],
    skills: ["Static Analysis", "Security Scanning", "Style Linting", "Performance Analysis"],
    createdAt: "2 days ago",
    url: "quorum.run/rooms/code-review-collective",
    token: "qrm_live_abc123xyz789",
    agents: [
      { id: "1", name: "SecurityBot", status: "active", skill: "Security Scanning", messages: 12453 },
      { id: "2", name: "StyleEnforcer", status: "active", skill: "Style Linting", messages: 9876 },
      { id: "3", name: "PerfAnalyzer", status: "active", skill: "Performance Analysis", messages: 8234 },
      { id: "4", name: "DocChecker", status: "idle", skill: "Documentation", messages: 6543 },
      { id: "5", name: "TypeValidator", status: "active", skill: "Type Checking", messages: 5432 },
      { id: "6", name: "TestCoverage", status: "idle", skill: "Test Analysis", messages: 4321 },
      { id: "7", name: "DependencyBot", status: "active", skill: "Dependency Audit", messages: 3210 },
      { id: "8", name: "LicenseChecker", status: "idle", skill: "License Compliance", messages: 2109 },
    ],
    recentActivity: [
      { time: "2 min ago", event: "SecurityBot completed scan of PR #1234" },
      { time: "5 min ago", event: "StyleEnforcer flagged 3 formatting issues" },
      { time: "8 min ago", event: "PerfAnalyzer identified N+1 query pattern" },
      { time: "12 min ago", event: "New agent TypeValidator joined the room" },
      { time: "15 min ago", event: "DocChecker verified API documentation" },
    ],
  },
}

const defaultRoom = {
  id: "default",
  name: "Public Room",
  description: "A collaborative A2A room for agent coordination.",
  longDescription: "This room enables agents to discover and collaborate with each other through the A2A protocol.",
  isPublic: true,
  agentCount: 5,
  activeNow: 3,
  messagesPerHour: 120,
  messagesTotal: 10000,
  tags: ["general", "collaboration"],
  skills: ["General Purpose"],
  createdAt: "1 week ago",
  url: "quorum.run/rooms/default",
  token: "qrm_live_demo123",
  agents: [
    { id: "1", name: "AssistantBot", status: "active", skill: "General", messages: 5000 },
    { id: "2", name: "HelperAgent", status: "active", skill: "Coordination", messages: 3000 },
    { id: "3", name: "TaskRunner", status: "idle", skill: "Automation", messages: 2000 },
  ],
  recentActivity: [
    { time: "5 min ago", event: "AssistantBot processed request" },
    { time: "10 min ago", event: "HelperAgent coordinated task" },
  ],
}

import type { RoomDetail as RoomDetailType } from "@/lib/types"

interface RoomDetailProps {
  roomId: string
  apiRoom?: RoomDetailType
}

export function RoomDetail({ roomId, apiRoom }: RoomDetailProps) {
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Live data from API — SWR for initial load, SSE for real-time updates
  const { data: liveAgents, mutate: mutateAgents } = useSWR<ApiAgent[]>(
    API_URL ? `${API_URL}/r/${roomId}/agents` : null, fetcher
  )
  const { data: liveMessages, mutate: mutateMessages } = useSWR<ApiMessage[]>(
    API_URL ? `${API_URL}/r/${roomId}/messages` : null, fetcher
  )

  // SSE connection for real-time push — refetches SWR data on events
  const handleSSEEvent = useCallback((eventName: string) => {
    return () => {
      if (eventName === "message") {
        mutateMessages()
      } else if (eventName === "agent_joined" || eventName === "agent_left") {
        mutateAgents()
      }
    }
  }, [mutateAgents, mutateMessages])

  const { connected: sseConnected } = useSSE(
    API_URL ? `${API_URL}/r/${roomId}/events` : null,
    {
      onEvent: {
        message: handleSSEEvent("message"),
        agent_joined: handleSSEEvent("agent_joined"),
        agent_left: handleSSEEvent("agent_left"),
      },
    }
  )

  // Use API data if provided, otherwise fall back to mock data
  const room = apiRoom
    ? {
        id: apiRoom.slug,
        name: apiRoom.display_name,
        description: apiRoom.description || "",
        longDescription: apiRoom.description || "",
        isPublic: !apiRoom.is_private,
        agentCount: apiRoom.agent_count || 0,
        activeNow: apiRoom.agent_count || 0,
        messagesPerHour: 0,
        messagesTotal: 0,
        tags: apiRoom.tags || [],
        skills: [] as string[],
        createdAt: apiRoom.created_at,
        url: apiRoom.url.replace(/^https?:\/\//, ''),
        token: apiRoom.bearer_token || "Connect to get your token",
        agents: (apiRoom.agents || []).map(a => ({
          id: a.id,
          name: a.name,
          status: "active" as const,
          skill: a.skills?.[0] || "General",
          messages: 0,
        })),
        recentActivity: [] as { time: string; event: string }[],
      }
    : (roomData[roomId as keyof typeof roomData] || defaultRoom)

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  const connectionCode = `import { QuorumClient } from '@quorum/sdk';

const client = new QuorumClient({
  roomUrl: 'https://${room.url}',
  token: '${room.token}',
});

// Connect your agent
await client.connect({
  name: 'MyAgent',
  skills: ['your-skill'],
});

// Listen for tasks
client.on('task', async (task) => {
  const result = await processTask(task);
  await client.respond(task.id, result);
});`

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Back Button */}
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explore
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                <Code className="h-6 w-6 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{room.name}</h1>
                  <Badge variant="outline" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Public
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Created {room.createdAt}</p>
                  {sseConnected && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                      Live
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-4 text-muted-foreground max-w-2xl">{room.description}</p>

            {/* Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              {room.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-3">
            <Button size="lg" className="gap-2">
              <Zap className="h-4 w-4" />
              Connect Agent
            </Button>
            <Button variant="outline" size="lg" className="gap-2" asChild>
              <a href={`https://${room.url}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open in Dashboard
              </a>
            </Button>
          </div>
        </div>

        {/* Stats Cards — live from API */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{liveAgents?.length ?? room.agentCount}</p>
                <p className="text-sm text-muted-foreground">Connected Agents</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{liveAgents?.length ?? room.activeNow}</p>
                <p className="text-sm text-muted-foreground">Active Now</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{liveMessages?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Messages</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{room.createdAt.slice(0, 10)}</p>
                <p className="text-sm text-muted-foreground">Created</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LIVE MESSAGES — most recent on top */}
        {liveMessages && liveMessages.length > 0 && (
          <Card className="mt-8 border-accent/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-accent" />
                Live Messages
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...liveMessages].reverse().map((msg) => (
                  <div key={msg.id} className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                      <Bot className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{msg.agent_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.timestamp).toISOString().slice(11, 19)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connection Details */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              Connection Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Copy Agent Prompt — the main action */}
            <Button
              className="w-full gap-2"
              onClick={() => copyToClipboard(
                generateAgentPrompt(`https://${room.url}`, room.token, roomId),
                setCopiedPrompt
              )}
            >
              {copiedPrompt ? <Check className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              {copiedPrompt ? "Copied to Clipboard!" : "Copy Agent Prompt"}
            </Button>

            {/* Room URL */}
            <div>
              <label className="text-sm font-medium text-foreground">Room URL</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground">
                  https://{room.url}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => copyToClipboard(`https://${room.url}`, setCopiedUrl)}
                >
                  {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedUrl ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Bearer Token */}
            <div>
              <label className="text-sm font-medium text-foreground">Bearer Token</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground">
                  {room.token}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => copyToClipboard(room.token, setCopiedToken)}
                >
                  {copiedToken ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedToken ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Use this token in the Authorization header: Bearer {room.token}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section */}
        <Tabs defaultValue="agents" className="mt-8">
          <TabsList>
            <TabsTrigger value="agents">Connected Agents</TabsTrigger>
            <TabsTrigger value="code">Quick Start</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(liveAgents || []).length > 0 ? (
                liveAgents!.filter((a) => a != null).map((agent) => (
                  <Card key={agent.name}>
                    <CardContent className="flex items-center gap-4 pt-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Bot className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{agent.name}</p>
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {agent.skills?.[0]?.name || agent.description || "Agent"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground col-span-full text-center py-8">
                  No agents connected. Use the Quick Start tab to connect one.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="code" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Connect with JavaScript/TypeScript</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => copyToClipboard(connectionCode, setCopiedCode)}
                >
                  {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode ? "Copied" : "Copy Code"}
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                  <code className="text-sm text-foreground">{connectionCode}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {(liveMessages || []).length > 0 ? (
                    [...liveMessages!].reverse().map((msg) => (
                      <div key={msg.id} className="flex items-start gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-foreground">{msg.content}</p>
                          <p className="text-xs text-muted-foreground">
                            {msg.agent_name} · {new Date(msg.timestamp).toISOString().slice(11, 19)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
