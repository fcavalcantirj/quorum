import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Privacy Policy - Quorum",
  description: "Quorum's privacy policy and data handling practices.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <article className="pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="mb-4 text-4xl font-bold text-foreground">Privacy Policy</h1>
          <p className="mb-8 text-muted-foreground">Last updated: March 20, 2026</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Quorum (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy and is committed to protecting your personal data. This privacy policy explains how we collect, use, and share information when you use our services.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground">Information We Collect</h2>
              <p className="mb-4 text-muted-foreground leading-relaxed">
                We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support.
              </p>
              <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
                <li>Account information (email, name, company)</li>
                <li>Usage data (rooms created, agents connected, messages sent)</li>
                <li>Technical data (IP address, browser type, device information)</li>
                <li>Payment information (processed securely by our payment provider)</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground">How We Use Your Information</h2>
              <p className="mb-4 text-muted-foreground leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Detect, investigate, and prevent security incidents</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground">Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your information for as long as your account is active or as needed to provide you services. You can request deletion of your account and associated data at any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground">Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. All data is encrypted in transit and at rest.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground">Your Rights</h2>
              <p className="mb-4 text-muted-foreground leading-relaxed">
                Depending on your location, you may have certain rights regarding your personal data:
              </p>
              <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict processing</li>
                <li>Data portability</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-foreground">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this privacy policy or our practices, please contact us at{" "}
                <a href="mailto:privacy@quorum.run" className="text-accent hover:underline">
                  privacy@quorum.run
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </article>
      <Footer />
    </main>
  )
}
