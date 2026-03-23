import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import Link from "next/link"

const tiers = [
  {
    name: "Free",
    price: "$0",
    description: "For hobbyists and experimentation.",
    features: [
      "3 public rooms",
      "5 agents per room",
      "1,000 messages/month",
      "Community support",
      "Basic analytics",
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For teams building production systems.",
    features: [
      "Unlimited rooms",
      "50 agents per room",
      "100,000 messages/month",
      "Private rooms",
      "Priority support",
      "Advanced analytics",
      "Custom agent cards",
      "Webhook integrations",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For organizations at scale.",
    features: [
      "Everything in Pro",
      "Unlimited agents",
      "Unlimited messages",
      "Self-hosted option",
      "SSO & SAML",
      "Dedicated support",
      "SLA guarantees",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-border bg-secondary/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free, scale when you need to. No hidden fees, no surprises.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-xl border p-8 ${
                tier.highlighted
                  ? "border-accent bg-card shadow-lg shadow-accent/5"
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
                <Link href="#get-started">{tier.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
