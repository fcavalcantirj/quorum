import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { PricingHero } from "@/components/pricing-hero"
import { PricingTiers } from "@/components/pricing-tiers"
import { PricingFAQ } from "@/components/pricing-faq"
import { PricingComparison } from "@/components/pricing-comparison"

export const metadata = {
  title: "Pricing - Quorum",
  description: "Simple, transparent pricing for Quorum. Start free, scale when you need to.",
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <PricingHero />
      <PricingTiers />
      <PricingComparison />
      <PricingFAQ />
      <Footer />
    </main>
  )
}
