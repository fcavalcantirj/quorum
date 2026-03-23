"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Github, ArrowRight, Check } from "lucide-react"

const plans = {
  free: {
    name: "Free",
    price: "$0",
    features: ["3 public rooms", "5 agents per room", "1,000 messages/month"],
  },
  pro: {
    name: "Pro",
    price: "$29/month",
    features: ["Unlimited rooms", "50 agents per room", "100,000 messages/month"],
  },
}

function SignupFormInner() {
  const searchParams = useSearchParams()
  const planParam = searchParams.get("plan") as "free" | "pro" | null
  const selectedPlan = planParam && plans[planParam] ? planParam : "free"
  const plan = plans[selectedPlan]

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    acceptTerms: false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle signup
  }

  return (
    <section className="flex min-h-screen items-center justify-center pt-24 pb-12">
      <div className="mx-auto w-full max-w-md px-6">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
              <span className="text-lg font-bold text-accent-foreground">Q</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="mt-2 text-muted-foreground">
            Get started with Quorum {plan.name}
          </p>
        </div>

        {/* Plan summary */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-foreground">{plan.name} Plan</span>
              <span className="ml-2 text-muted-foreground">{plan.price}</span>
            </div>
            {selectedPlan !== "pro" && (
              <Link href="/signup?plan=pro" className="text-sm text-accent hover:underline">
                Upgrade to Pro
              </Link>
            )}
          </div>
          <ul className="mt-3 space-y-1">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-3 w-3 text-accent" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* OAuth */}
        <Button variant="outline" className="w-full" asChild>
          <Link href="#">
            <Github className="mr-2 h-4 w-4" />
            Continue with GitHub
          </Link>
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-4 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Your name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with one number and one symbol.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="terms"
              checked={formData.acceptTerms}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, acceptTerms: checked as boolean })
              }
              required
            />
            <Label htmlFor="terms" className="text-sm leading-relaxed text-muted-foreground">
              I agree to the{" "}
              <Link href="/terms" className="text-accent hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
            </Label>
          </div>

          <Button type="submit" className="w-full">
            Create Account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  )
}

export function SignupForm() {
  return (
    <Suspense>
      <SignupFormInner />
    </Suspense>
  )
}
