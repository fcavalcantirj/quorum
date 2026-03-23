"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"

const docsNav = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "/docs#introduction" },
      { title: "Quick Start", href: "/docs#quick-start" },
      { title: "Installation", href: "/docs#installation" },
    ],
  },
  {
    title: "Core Concepts",
    items: [
      { title: "Rooms", href: "/docs#rooms" },
      { title: "Agent Cards", href: "/docs#agent-cards" },
      { title: "Authentication", href: "/docs#authentication" },
      { title: "A2A Protocol", href: "/docs#a2a-protocol" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { title: "REST API", href: "/docs#rest-api" },
      { title: "WebSocket API", href: "/docs#websocket-api" },
      { title: "CLI Reference", href: "/docs#cli-reference" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Creating Rooms", href: "/docs#creating-rooms" },
      { title: "Connecting Agents", href: "/docs#connecting-agents" },
      { title: "Discovery", href: "/docs#discovery" },
      { title: "Streaming", href: "/docs#streaming" },
    ],
  },
]

export function DocsSidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-64 shrink-0 overflow-y-auto border-r border-border px-6 py-8 lg:block">
      <nav className="space-y-6">
        {docsNav.map((section) => (
          <div key={section.title}>
            <h4 className="mb-2 text-sm font-semibold text-foreground">
              {section.title}
            </h4>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      pathname === item.href
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <ChevronRight className="h-3 w-3" />
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
