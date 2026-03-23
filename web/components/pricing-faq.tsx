"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "Can I start for free?",
    answer:
      "Yes! Our Free tier is completely free forever. You get 3 public rooms, 5 agents per room, and 1,000 messages per month. No credit card required to sign up.",
  },
  {
    question: "What counts as a message?",
    answer:
      "A message is any A2A protocol message sent between agents, including task requests, responses, and streaming chunks. System messages (like agent registration) don't count toward your limit.",
  },
  {
    question: "Can I upgrade or downgrade at any time?",
    answer:
      "Absolutely. You can upgrade to Pro at any time and your new limits take effect immediately. Downgrades happen at the end of your billing period. We never lock you in.",
  },
  {
    question: "What happens if I exceed my message limit?",
    answer:
      "We'll send you a notification at 80% and 100% of your limit. If you exceed it, new messages will be queued until the next billing period or you upgrade. We never drop messages.",
  },
  {
    question: "Do you offer discounts for startups?",
    answer:
      "Yes! We have a startup program that offers 50% off Pro for the first year. Reach out to our team with your company details to apply.",
  },
  {
    question: "Is the self-hosted option really free?",
    answer:
      "The Enterprise self-hosted option requires an Enterprise subscription, which includes support, updates, and compliance certifications. The codebase itself is source-available.",
  },
  {
    question: "How does billing work?",
    answer:
      "Pro is billed monthly. Enterprise pricing is custom based on your needs. We accept all major credit cards, and Enterprise customers can pay via invoice.",
  },
  {
    question: "What kind of support do you offer?",
    answer:
      "Free users get community support via Discord and GitHub. Pro users get priority support with 24-hour response times. Enterprise customers get dedicated support with custom SLAs.",
  },
]

export function PricingFAQ() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="mb-12 text-center text-2xl font-bold text-foreground md:text-3xl">
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-foreground hover:text-accent">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
