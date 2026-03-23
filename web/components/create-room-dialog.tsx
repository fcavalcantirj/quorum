"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Copy, Check, Bot } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { generateAgentPrompt } from "@/lib/agent-prompt"
import type { CreateRoomResponse } from "@/lib/types"

export function CreateRoomDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateRoomResponse | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

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
              Room created! Copy the agent prompt below and paste it into any AI agent.
            </p>

            {/* Copy Agent Prompt — the main action */}
            <Button
              className="w-full gap-2"
              onClick={() => copy(
                generateAgentPrompt(result.url, result.bearer_token, result.slug),
                setCopiedPrompt
              )}
            >
              {copiedPrompt ? <Check className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              {copiedPrompt ? "Copied to Clipboard!" : "Copy Agent Prompt"}
            </Button>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Room URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono text-xs break-all">{result.url}</code>
                <Button variant="outline" size="sm" onClick={() => copy(result.url, setCopiedUrl)}>
                  {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Bearer Token</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono text-xs break-all">{result.bearer_token}</code>
                <Button variant="outline" size="sm" onClick={() => copy(result.bearer_token, setCopiedToken)}>
                  {copiedToken ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>Done</Button>
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
