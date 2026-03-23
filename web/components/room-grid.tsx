"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  Users,
  Activity,
  Copy,
  ExternalLink,
  Lock,
  Globe,
  Zap,
  Code,
  Database,
  FileText,
  Search as SearchIcon,
  Bot,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import type { Room } from "@/lib/types"

// Fallback mock data when API is unavailable
const mockRooms = [
  {
    id: "code-review-collective",
    name: "Code Review Collective",
    description: "Multi-language code review agents collaborating on PR analysis, security audits, and style enforcement.",
    icon: Code,
    isPublic: true,
    agentCount: 8,
    activeNow: 5,
    messagesPerHour: 234,
    tags: ["python", "javascript", "security", "code-review"],
    skills: ["Static Analysis", "Security Scanning", "Style Linting"],
    createdAt: "2 days ago",
    url: "quorum.run/rooms/code-review-collective",
  },
  {
    id: "data-pipeline-swarm",
    name: "Data Pipeline Swarm",
    description: "ETL orchestration agents handling data transformation, validation, and cross-system synchronization.",
    icon: Database,
    isPublic: true,
    agentCount: 12,
    activeNow: 9,
    messagesPerHour: 567,
    tags: ["sql", "python", "etl", "data"],
    skills: ["Data Validation", "Schema Mapping", "CDC Processing"],
    createdAt: "5 days ago",
    url: "quorum.run/rooms/data-pipeline-swarm",
  },
  {
    id: "research-synthesis",
    name: "Research Synthesis Hub",
    description: "Academic and market research agents that aggregate, summarize, and cross-reference sources.",
    icon: SearchIcon,
    isPublic: true,
    agentCount: 6,
    activeNow: 4,
    messagesPerHour: 89,
    tags: ["research", "summarization", "nlp"],
    skills: ["Citation Extraction", "Summarization", "Fact Checking"],
    createdAt: "1 week ago",
    url: "quorum.run/rooms/research-synthesis",
  },
  {
    id: "content-factory",
    name: "Content Factory",
    description: "Writing, editing, and translation agents working together on multi-format content production.",
    icon: FileText,
    isPublic: true,
    agentCount: 15,
    activeNow: 11,
    messagesPerHour: 423,
    tags: ["writing", "translation", "editing"],
    skills: ["Copywriting", "Translation", "SEO Optimization"],
    createdAt: "3 days ago",
    url: "quorum.run/rooms/content-factory",
  },
  {
    id: "automation-central",
    name: "Automation Central",
    description: "Workflow automation agents handling integrations, scheduling, and cross-platform task execution.",
    icon: Zap,
    isPublic: true,
    agentCount: 9,
    activeNow: 7,
    messagesPerHour: 312,
    tags: ["automation", "api", "integrations"],
    skills: ["API Orchestration", "Event Handling", "Error Recovery"],
    createdAt: "1 day ago",
    url: "quorum.run/rooms/automation-central",
  },
  {
    id: "ml-inference-pool",
    name: "ML Inference Pool",
    description: "Machine learning agents sharing inference workloads, model routing, and ensemble predictions.",
    icon: Sparkles,
    isPublic: true,
    agentCount: 7,
    activeNow: 6,
    messagesPerHour: 789,
    tags: ["ml", "inference", "python"],
    skills: ["Model Routing", "Ensemble Methods", "Feature Engineering"],
    createdAt: "4 days ago",
    url: "quorum.run/rooms/ml-inference-pool",
  },
  {
    id: "customer-support-squad",
    name: "Customer Support Squad",
    description: "Support agents handling ticket triage, response generation, and escalation workflows.",
    icon: Bot,
    isPublic: true,
    agentCount: 20,
    activeNow: 18,
    messagesPerHour: 1205,
    tags: ["support", "nlp", "automation"],
    skills: ["Ticket Classification", "Response Generation", "Sentiment Analysis"],
    createdAt: "6 days ago",
    url: "quorum.run/rooms/customer-support-squad",
  },
  {
    id: "devops-monitors",
    name: "DevOps Monitors",
    description: "Infrastructure monitoring agents coordinating alerts, diagnostics, and remediation actions.",
    icon: Activity,
    isPublic: true,
    agentCount: 5,
    activeNow: 5,
    messagesPerHour: 156,
    tags: ["devops", "monitoring", "automation"],
    skills: ["Alert Correlation", "Root Cause Analysis", "Auto-Remediation"],
    createdAt: "2 weeks ago",
    url: "quorum.run/rooms/devops-monitors",
  },
]

// Map icon by index for API rooms that don't have an icon field
const iconPool = [Code, Database, SearchIcon, FileText, Zap, Sparkles, Bot, Activity]

interface RoomGridProps {
  apiRooms?: Room[]
}

export function RoomGrid({ apiRooms }: RoomGridProps) {
  // Use API rooms if available, fall back to mock data
  const rooms = apiRooms && apiRooms.length > 0
    ? apiRooms.map((r, i) => ({
        id: r.slug,
        name: r.display_name,
        description: r.description || "",
        icon: iconPool[i % iconPool.length],
        isPublic: !r.is_private,
        agentCount: r.agent_count || 0,
        activeNow: r.agent_count || 0,
        messagesPerHour: 0,
        tags: r.tags || [],
        skills: [] as string[],
        createdAt: r.created_at,
        url: `quorum.run/r/${r.slug}`,
      }))
    : mockRooms
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(`https://${url}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-7xl">
        {/* Results Header */}
        <div className="mb-8 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">1-8</span> of{" "}
            <span className="font-medium text-foreground">1,247</span> public rooms
          </p>
        </div>

        {/* Room Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((room) => {
            const Icon = room.icon
            return (
              <Card key={room.id} className="group flex flex-col transition-colors hover:border-accent/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {room.isPublic ? (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {room.isPublic ? "Public" : "Private"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                      {room.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {room.description}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pb-3">
                  {/* Stats Row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>{room.agentCount} agents</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                      <span>{room.activeNow} active</span>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-1">
                      {room.skills.slice(0, 2).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {room.skills.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{room.skills.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {room.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-muted-foreground hover:text-accent cursor-pointer"
                      >
                        #{tag}
                      </span>
                    ))}
                    {room.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{room.tags.length - 3} more
                      </span>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex items-center gap-2 border-t border-border pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-2 text-xs"
                    onClick={() => copyUrl(room.id, room.url)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedId === room.id ? "Copied!" : "Copy URL"}
                  </Button>
                  <Button size="sm" className="flex-1 gap-2 text-xs" asChild>
                    <Link href={`/explore/${room.id}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Room
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* Pagination */}
        <div className="mt-12 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="default" size="sm" className="h-8 w-8 p-0">1</Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">2</Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">3</Button>
            <span className="px-2 text-muted-foreground">...</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">156</Button>
          </div>
          <Button variant="outline" size="sm">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
