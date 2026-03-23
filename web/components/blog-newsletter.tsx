"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail } from "lucide-react"

export function BlogNewsletter() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setSubmitted(true)
      setEmail("")
    }
  }

  return (
    <section className="border-t border-border bg-secondary/30 py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
          <Mail className="h-6 w-6 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-foreground md:text-3xl">
          Stay in the loop
        </h2>
        <p className="mt-4 text-muted-foreground">
          Get the latest posts on A2A protocols, multi-agent systems, and Quorum updates delivered to your inbox.
        </p>

        {submitted ? (
          <div className="mt-8 rounded-lg border border-accent/50 bg-accent/10 p-4">
            <p className="text-accent">Thanks for subscribing! Check your inbox to confirm.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sm:w-72"
              required
            />
            <Button type="submit">Subscribe</Button>
          </form>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          No spam, unsubscribe anytime. We respect your privacy.
        </p>
      </div>
    </section>
  )
}
