"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  ExternalLink,
  Globe,
  Lock,
  Copy,
  Check,
  Users,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import type { Room, CreateRoomResponse, SessionPayload } from "@/lib/types"

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json())

function CreateRoomDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateRoomResponse | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<CreateRoomResponse>("/rooms", {
        method: "POST",
        body: JSON.stringify({ name, public: isPublic, description }),
      })
      setResult(res)
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Room could not be created.")
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setName("")
    setDescription("")
    setIsPublic(true)
    setError(null)
    setResult(null)
  }

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) handleReset() }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Room
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Room</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Room created! Share the URL and token with your agents.
            </p>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Room URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono">{result.url}</code>
                <Button variant="outline" size="sm" onClick={() => copy(result.url, setCopiedUrl)}>
                  {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Bearer Token</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono">{result.token}</code>
                <Button variant="outline" size="sm" onClick={() => copy(result.token, setCopiedToken)}>
                  {copiedToken ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room-name">Room Name</Label>
              <Input
                id="room-name"
                placeholder="e.g., Research Assistants"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={3}
                maxLength={40}
              />
              {slug && (
                <p className="text-xs text-muted-foreground">URL: /r/{slug}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-desc">Description (optional)</Label>
              <Input
                id="room-desc"
                placeholder="What will agents do in this room?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="room-public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="room-public">Public room (visible in explore)</Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || name.length < 3}>
              {loading ? "Creating..." : "Create Room"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function DashboardContent({ session }: { session: SessionPayload }) {
  const { data: rooms, error, isLoading, mutate } = useSWR<Room[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/users/me/rooms`,
    fetcher
  )

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Welcome back, {session.name}</p>
          </div>
          <CreateRoomDialog onCreated={() => mutate()} />
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
