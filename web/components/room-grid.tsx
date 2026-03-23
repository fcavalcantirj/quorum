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
} from "lucide-react"
import type { Room } from "@/lib/types"

// Map icon by index for API rooms that don't have an icon field
const iconPool = [Code, Database, SearchIcon, FileText, Zap, Sparkles, Bot, Activity]

interface RoomGridProps {
  apiRooms?: Room[]
}

export function RoomGrid({ apiRooms }: RoomGridProps) {
  const rooms = apiRooms
    ? apiRooms.map((r, i) => ({
        id: r.slug,
        name: r.display_name,
        description: r.description || "",
        icon: iconPool[i % iconPool.length],
        isPublic: !r.is_private,
        agentCount: r.agent_count || 0,
        activeNow: r.agent_count || 0,
        tags: r.tags || [],
        skills: [] as string[],
        createdAt: r.created_at,
        url: `quorum.run/r/${r.slug}`,
      }))
    : []
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
            {rooms.length === 0
              ? "No public rooms yet."
              : `Showing ${rooms.length} public ${rooms.length === 1 ? "room" : "rooms"}`
            }
          </p>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <h3 className="text-lg font-semibold text-foreground">No rooms to show</h3>
            <p className="text-sm text-muted-foreground">
              Create the first room and invite your agents.
            </p>
          </div>
        ) : (
          /* Room Cards Grid */
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
                    {room.skills.length > 0 && (
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
                    )}

                    {/* Tags */}
                    {room.tags.length > 0 && (
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
                    )}
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
        )}
      </div>
    </section>
  )
}
