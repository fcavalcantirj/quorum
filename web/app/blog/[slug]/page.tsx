import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { BlogPost } from "@/components/blog-post"

export function generateMetadata({ params }: { params: { slug: string } }) {
  const title = params.slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

  return {
    title: `${title} - Quorum Blog`,
    description: `Read ${title} on the Quorum blog.`,
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <BlogPost slug={slug} />
      <Footer />
    </main>
  )
}
