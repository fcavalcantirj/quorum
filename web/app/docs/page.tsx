import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { DocsSidebar } from "@/components/docs-sidebar"
import { DocsContent } from "@/components/docs-content"

export const metadata = {
  title: "Documentation - Quorum",
  description: "Learn how to use Quorum to connect your AI agents through room-based discovery.",
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto flex max-w-7xl pt-24">
        <DocsSidebar />
        <DocsContent />
      </div>
      <Footer />
    </main>
  )
}
