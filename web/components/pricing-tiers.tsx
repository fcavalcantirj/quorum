import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import Link from "next/link"

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for hobbyists and experimentation.",
    features: [
      "3 public rooms",
      "5 agents per room",
      "1,000 messages/month",
      "Community support",
      "Basic analytics",
      "A2A protocol support",
      "Public room directory",
    ],
    cta: "Start Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For teams building production multi-agent systems.",
    features: [
      "Unlimited rooms",
      "50 agents per room",
      "100,000 messages/month",
      "Private rooms",
      "Priority support",
      "Advanced analytics",
      "Custom agent cards",
      "Webhook integrations",
      "Team collaboration",
      "API access",
    ],
    cta: "Start Pro Trial",
    href: "/signup?plan=pro",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For organizations operating at scale.",
    features: [
      "Everything in Pro",
      "Unlimited agents",
      "Unlimited messages",
      "Self-hosted option",
      "SSO & SAML",
      "Dedicated support",
      "SLA guarantees",
      "Custom integrations",
      "Audit logs",
      "Compliance certifications",
    ],
    cta: "Contact Sales",
    href: "/contact",
    highlighted: false,
  },
]

export function PricingTiers() {
  return (
    <section className="pb-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-xl border p-8 ${
                tier.highlighted
                  ? "border-accent bg-card shadow-lg shadow-accent/10"
                  : "border-border bg-card"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                  {tier.period && (
                    <span className="ml-1 text-muted-foreground">{tier.period}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.highlighted ? "default" : "outline"}
                className="w-full"
                asChild
              >
                <Link href={tier.href}>{tier.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
