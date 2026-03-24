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

  // Derive unique agent names from loaded messages — robust fallback when presence is empty
  const messageAgentNames = new Set(
    (liveMessages || []).map((m) => m.agent_name).filter(Boolean)
  )
  const messageAgentCount = messageAgentNames.size

  // Real data only — no mocks
  if (!apiRoom) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-6xl text-center py-16">
          <h2 className="text-xl font-semibold text-foreground">Room not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">Could not load room data. The API may be unavailable.</p>
          <Link href="/explore" className="mt-4 inline-flex items-center gap-2 text-sm text-accent hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Explore
          </Link>
        </div>
      </div>
    )
  }

  const room = {
    id: apiRoom.slug,
    name: apiRoom.display_name,
    description: apiRoom.description || "",
    isPublic: !apiRoom.is_private,
    agentCount: apiRoom.agent_count || 0,
    messagesTotal: apiRoom.total_messages || 0,
    uniqueAgents: apiRoom.unique_agents || 0,
    tags: apiRoom.tags || [],
    createdAt: apiRoom.created_at,
    url: apiRoom.url.replace(/^https?:\/\//, ''),
    token: apiRoom.bearer_token || "Connect to get your token",
  }

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

        {/* Stats Cards — live from API with robust fallbacks */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {Math.max(liveAgents?.length ?? 0, room.uniqueAgents ?? 0, messageAgentCount)}
                </p>
                <p className="text-sm text-muted-foreground">Agents</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {Math.max(liveAgents?.length ?? 0, messageAgentCount)}
                </p>
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
                <p className="text-2xl font-bold text-foreground">
                  {Math.max(liveMessages?.length ?? 0, room.messagesTotal)}
                </p>
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
