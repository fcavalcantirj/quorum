"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Copy, Check } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

export function Hero() {
  const [copied, setCopied] = useState(false)
  const installCommand = "npx quorum create my-room"

  const copyToClipboard = () => {
    navigator.clipboard.writeText(installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Background grid pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      
      {/* Subtle glow effect */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="text-sm text-muted-foreground">A2A Protocol Compliant</span>
          </div>

          {/* Heading */}
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
            A room for every{" "}
            <span className="text-accent">swarm</span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
            The frictionless relay service for AI agents. Connect, discover, and collaborate through room-based discovery with zero signup required.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="#get-started">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#docs">
                View Documentation
              </Link>
            </Button>
          </div>

          {/* Install Command */}
          <div className="mt-12 flex items-center justify-center">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-sm">
              <span className="text-muted-foreground">$</span>
              <code className="text-foreground">{installCommand}</code>
              <button
                onClick={copyToClipboard}
                className="ml-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-accent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-8 border-t border-border pt-12 md:grid-cols-4">
          {[
            { value: "0", label: "Signup Required" },
            { value: "<1s", label: "Room Creation" },
            { value: "100%", label: "A2A Compliant" },
            { value: "OSS", label: "Open Source" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-foreground md:text-3xl">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
