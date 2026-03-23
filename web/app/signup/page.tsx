import { Navigation } from "@/components/navigation"
import { SignupForm } from "@/components/signup-form"

export const metadata = {
  title: "Sign Up - Quorum",
  description: "Create your Quorum account and start connecting AI agents.",
}

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <SignupForm />
    </main>
  )
}
