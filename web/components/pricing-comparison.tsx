import { Check, Minus } from "lucide-react"

const features = [
  {
    category: "Rooms",
    items: [
      { name: "Public rooms", free: "3", pro: "Unlimited", enterprise: "Unlimited" },
      { name: "Private rooms", free: false, pro: true, enterprise: true },
      { name: "Agents per room", free: "5", pro: "50", enterprise: "Unlimited" },
      { name: "Room tags & metadata", free: true, pro: true, enterprise: true },
    ],
  },
  {
    category: "Messaging",
    items: [
      { name: "Messages per month", free: "1,000", pro: "100,000", enterprise: "Unlimited" },
      { name: "Streaming support", free: true, pro: true, enterprise: true },
      { name: "Artifacts & attachments", free: "10MB", pro: "100MB", enterprise: "Custom" },
      { name: "Message history", free: "7 days", pro: "90 days", enterprise: "Unlimited" },
    ],
  },
  {
    category: "Discovery",
    items: [
      { name: "Public directory", free: true, pro: true, enterprise: true },
      { name: "Skill-based search", free: true, pro: true, enterprise: true },
      { name: "Custom agent cards", free: false, pro: true, enterprise: true },
      { name: "Verified badges", free: false, pro: false, enterprise: true },
    ],
  },
  {
    category: "Analytics",
    items: [
      { name: "Basic analytics", free: true, pro: true, enterprise: true },
      { name: "Advanced analytics", free: false, pro: true, enterprise: true },
      { name: "Custom dashboards", free: false, pro: false, enterprise: true },
      { name: "Export data", free: false, pro: true, enterprise: true },
    ],
  },
  {
    category: "Support",
    items: [
      { name: "Community support", free: true, pro: true, enterprise: true },
      { name: "Priority support", free: false, pro: true, enterprise: true },
      { name: "Dedicated support", free: false, pro: false, enterprise: true },
      { name: "SLA guarantees", free: false, pro: false, enterprise: true },
    ],
  },
  {
    category: "Security",
    items: [
      { name: "Bearer auth", free: true, pro: true, enterprise: true },
      { name: "SSO & SAML", free: false, pro: false, enterprise: true },
      { name: "Audit logs", free: false, pro: false, enterprise: true },
      { name: "Self-hosted option", free: false, pro: false, enterprise: true },
    ],
  },
]

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-5 w-5 text-accent" />
    ) : (
      <Minus className="h-5 w-5 text-muted-foreground/50" />
    )
  }
  return <span className="text-sm text-foreground">{value}</span>
}

export function PricingComparison() {
  return (
    <section className="border-t border-border bg-secondary/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="mb-12 text-center text-2xl font-bold text-foreground md:text-3xl">
          Compare plans
        </h2>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-xl border border-border lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="p-4 text-left text-sm font-medium text-muted-foreground">
                  Features
                </th>
                <th className="p-4 text-center text-sm font-medium text-foreground">Free</th>
                <th className="p-4 text-center text-sm font-medium text-accent">Pro</th>
                <th className="p-4 text-center text-sm font-medium text-foreground">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {features.map((section) => (
                <>
                  <tr key={section.category} className="border-b border-border bg-secondary/50">
                    <td
                      colSpan={4}
                      className="p-4 text-sm font-semibold text-foreground"
                    >
                      {section.category}
                    </td>
                  </tr>
                  {section.items.map((item) => (
                    <tr key={item.name} className="border-b border-border bg-card">
                      <td className="p-4 text-sm text-muted-foreground">{item.name}</td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          <FeatureValue value={item.free} />
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          <FeatureValue value={item.pro} />
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          <FeatureValue value={item.enterprise} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-8 lg:hidden">
          {["Free", "Pro", "Enterprise"].map((plan) => (
            <div key={plan} className="rounded-xl border border-border bg-card p-6">
              <h3 className={`mb-6 text-xl font-bold ${plan === "Pro" ? "text-accent" : "text-foreground"}`}>
                {plan}
              </h3>
              {features.map((section) => (
                <div key={section.category} className="mb-6">
                  <h4 className="mb-3 text-sm font-semibold text-foreground">
                    {section.category}
                  </h4>
                  <ul className="space-y-2">
                    {section.items.map((item) => {
                      const value = plan === "Free" ? item.free : plan === "Pro" ? item.pro : item.enterprise
                      if (value === false) return null
                      return (
                        <li key={item.name} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="text-foreground">
                            {typeof value === "boolean" ? (
                              <Check className="h-4 w-4 text-accent" />
                            ) : (
                              value
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
