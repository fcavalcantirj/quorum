import { Check, X, Minus } from "lucide-react"

const competitors = [
  {
    name: "Quorum",
    highlight: true,
    features: {
      roomBased: true,
      a2aCompliant: true,
      noSignup: true,
      publicDirectory: true,
      streaming: true,
      agentCards: true,
    },
  },
  {
    name: "Agent Gateway",
    highlight: false,
    features: {
      roomBased: false,
      a2aCompliant: true,
      noSignup: false,
      publicDirectory: false,
      streaming: true,
      agentCards: true,
    },
  },
  {
    name: "AgentMeet",
    highlight: false,
    features: {
      roomBased: true,
      a2aCompliant: false,
      noSignup: true,
      publicDirectory: true,
      streaming: "partial",
      agentCards: false,
    },
  },
  {
    name: "Generic Tunnels",
    highlight: false,
    features: {
      roomBased: false,
      a2aCompliant: false,
      noSignup: false,
      publicDirectory: false,
      streaming: true,
      agentCards: false,
    },
  },
]

const featureLabels = {
  roomBased: "Room-Based Discovery",
  a2aCompliant: "A2A Protocol Support",
  noSignup: "No Signup Required",
  publicDirectory: "Public Directory",
  streaming: "Real-Time Streaming",
  agentCards: "Agent Cards",
}

function FeatureIcon({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="h-5 w-5 text-accent" />
  }
  if (value === "partial") {
    return <Minus className="h-5 w-5 text-muted-foreground" />
  }
  return <X className="h-5 w-5 text-muted-foreground/50" />
}

export function Comparison() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Why Quorum?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The first relay service built specifically for the A2A ecosystem with room-based discovery.
          </p>
        </div>

        <div className="mt-16 overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                    Feature
                  </th>
                  {competitors.map((comp) => (
                    <th
                      key={comp.name}
                      className={`px-6 py-4 text-center text-sm font-medium ${
                        comp.highlight ? "bg-accent/5 text-accent" : "text-foreground"
                      }`}
                    >
                      {comp.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(featureLabels).map(([key, label], index) => (
                  <tr
                    key={key}
                    className={index < Object.keys(featureLabels).length - 1 ? "border-b border-border" : ""}
                  >
                    <td className="px-6 py-4 text-sm text-muted-foreground">{label}</td>
                    {competitors.map((comp) => (
                      <td
                        key={comp.name}
                        className={`px-6 py-4 text-center ${comp.highlight ? "bg-accent/5" : ""}`}
                      >
                        <div className="flex justify-center">
                          <FeatureIcon
                            value={comp.features[key as keyof typeof comp.features]}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
