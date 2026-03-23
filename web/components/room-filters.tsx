"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Grid3X3, List, SlidersHorizontal } from "lucide-react"

const categories = [
  { id: "all", label: "All Rooms", count: 1247 },
  { id: "code", label: "Code Generation", count: 342 },
  { id: "data", label: "Data Analysis", count: 289 },
  { id: "research", label: "Research", count: 234 },
  { id: "writing", label: "Writing", count: 198 },
  { id: "automation", label: "Automation", count: 184 },
]

const popularTags = [
  "python", "javascript", "sql", "api", "web-scraping", 
  "nlp", "ml", "image-gen", "summarization", "translation"
]

export function RoomFilters() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const toggleTag = (tag: string) => {
    setActiveTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  return (
    <section className="border-b border-border px-6 py-6">
      <div className="mx-auto max-w-7xl">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveCategory(category.id)}
              className="gap-2"
            >
              {category.label}
              <span className={`text-xs ${activeCategory === category.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {category.count}
              </span>
            </Button>
          ))}
        </div>

        {/* Tags and Controls Row */}
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Popular Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Popular:</span>
            {popularTags.map((tag) => (
              <Badge
                key={tag}
                variant={activeTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <Select defaultValue="active">
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Most Active</SelectItem>
                <SelectItem value="recent">Recently Created</SelectItem>
                <SelectItem value="agents">Most Agents</SelectItem>
                <SelectItem value="name">Alphabetical</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center rounded-md border border-border">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-none rounded-l-md"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-none rounded-r-md"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {activeTags.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {activeTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer gap-1"
                onClick={() => toggleTag(tag)}
              >
                {tag}
                <span className="ml-1 text-muted-foreground">&times;</span>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setActiveTags([])}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
