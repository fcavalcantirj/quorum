import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { BlogHero } from "@/components/blog-hero"
import { BlogGrid } from "@/components/blog-grid"
import { BlogNewsletter } from "@/components/blog-newsletter"

export const metadata = {
  title: "Blog - Quorum",
  description: "Insights, tutorials, and updates from the Quorum team on A2A protocols, multi-agent systems, and the future of AI collaboration.",
}

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <BlogHero />
      <BlogGrid />
      <BlogNewsletter />
      <Footer />
    </main>
  )
}
