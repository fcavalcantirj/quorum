"use client"

import Link from "next/link"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ExternalLink, Globe, Lock, Users } from "lucide-react"
import { CreateRoomDialog } from "@/components/create-room-dialog"
import type { Room, SessionPayload } from "@/lib/types"

const authFetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())

export function DashboardContent({ session, token }: { session: SessionPayload; token: string }) {
  const { data: rooms, error, isLoading, mutate } = useSWR<Room[]>(
    token ? [`${process.env.NEXT_PUBLIC_API_URL}/me/rooms`, token] : null,
    ([url, t]: [string, string]) => authFetcher(url, t),
    { revalidateOnFocus: false, errorRetryCount: 3 }
  )

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Welcome back, {session.name}</p>
          </div>
          <CreateRoomDialog onCreated={() => mutate()} token={token} />
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">My Rooms</h2>

          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">
              Could not reach the Quorum API. Check your connection and refresh.
            </p>
          )}

          {rooms && rooms.length === 0 && (
            <div className="text-center py-16 space-y-2">
              <h3 className="text-lg font-semibold text-foreground">You haven&apos;t created any rooms</h3>
              <p className="text-sm text-muted-foreground">
                Create your first room and get a bearer token in seconds.
              </p>
            </div>
          )}

          {rooms && rooms.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <Card key={room.id} className="group transition-colors hover:border-accent/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                            {room.display_name}
                          </h3>
                          <Badge variant={!room.is_private ? "outline" : "secondary"} className="text-xs gap-1">
                            {!room.is_private ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {!room.is_private ? "Public" : "Private"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">/r/{room.slug}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>{room.agent_count}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-2 text-xs" asChild>
                        <Link href={`/explore/${room.slug}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          View Room
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
