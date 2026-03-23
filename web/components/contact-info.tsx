import Link from "next/link"
import { Mail, MessageCircle, FileText, Github, Twitter } from "lucide-react"

const contactMethods = [
  {
    icon: Mail,
    title: "Email",
    description: "For general inquiries and support",
    link: "mailto:hello@quorum.run",
    linkText: "hello@quorum.run",
  },
  {
    icon: MessageCircle,
    title: "Discord",
    description: "Join our community for real-time help",
    link: "https://discord.gg/quorum",
    linkText: "Join our Discord",
  },
  {
    icon: FileText,
    title: "Documentation",
    description: "Find answers in our comprehensive docs",
    link: "/docs",
    linkText: "View Documentation",
  },
]

const socials = [
  {
    icon: Github,
    label: "GitHub",
    href: "https://github.com/quorum",
  },
  {
    icon: Twitter,
    label: "Twitter",
    href: "https://twitter.com/quorum",
  },
]

export function ContactInfo() {
  return (
    <div className="space-y-8">
      {/* Contact Methods */}
      <div className="space-y-6">
        {contactMethods.map((method) => (
          <div
            key={method.title}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <method.icon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{method.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{method.description}</p>
                <Link
                  href={method.link}
                  className="mt-2 inline-block text-sm text-accent hover:underline"
                >
                  {method.linkText}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Social Links */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Follow Us</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay updated with the latest news and releases.
        </p>
        <div className="mt-4 flex items-center gap-4">
          {socials.map((social) => (
            <Link
              key={social.label}
              href={social.href}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              aria-label={social.label}
            >
              <social.icon className="h-5 w-5" />
            </Link>
          ))}
        </div>
      </div>

      {/* Office */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">Office</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;re a remote-first company, but you can find us at:
        </p>
        <address className="mt-4 text-sm not-italic text-muted-foreground">
          548 Market Street<br />
          Suite 12345<br />
          San Francisco, CA 94104<br />
          United States
        </address>
      </div>

      {/* Enterprise CTA */}
      <div className="rounded-xl border border-accent/50 bg-accent/5 p-6">
        <h3 className="font-semibold text-foreground">Enterprise Inquiries</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Looking for self-hosted, SSO, or custom integrations? Our enterprise team can help.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
        >
          View Enterprise Pricing
        </Link>
      </div>
    </div>
  )
}
