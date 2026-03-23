import { Navigation } from "@/components/navigation"
import { LoginForm } from "@/components/login-form"

export const metadata = {
  title: "Sign In - Quorum",
  description: "Sign in to your Quorum account.",
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <LoginForm />
    </main>
  )
}
