import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Layers, MessageCircle, ArrowRight, Quote, Sparkles, BookOpen } from "lucide-react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import logo from "@/assets/note-pilot-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Note Pilot — Turn Your Notes Into a Study Plan" },
      { name: "description", content: "Upload your notes, set your test date. Note Pilot builds your study plan, flashcards, and personal AI coach automatically." },
      { property: "og:title", content: "Note Pilot — Turn Your Notes Into a Study Plan" },
      { property: "og:description", content: "AI-powered study assistant that creates personalised study plans from your notes." },
    ],
  }),
  component: LandingPage,
});

const features = [
  { icon: BookOpen, title: "AI Study Plan", description: "Day-by-day schedule built from your notes" },
  { icon: Layers, title: "Smart Flashcards", description: "Auto-generated from your exact content" },
  { icon: MessageCircle, title: "AI Coach", description: "Ask questions. Get answers from your notes." },
];

const steps = [
  { number: 1, title: "Upload Your Notes", description: "Drop in any PDF, DOCX or image. We handle the rest." },
  { number: 2, title: "Set Your Test Date", description: "Tell us when your exam is. Note Pilot builds around your schedule." },
  { number: 3, title: "Start Studying", description: "Get your personalised plan, flashcards and AI coach instantly." },
];

const testimonials = [
  { quote: "Note Pilot turned my messy biology notes into a full 2-week plan. Incredible.", name: "Aoife", label: "Leaving Cert" },
  { quote: "The flashcards alone saved me hours. Actually studied smarter for once.", name: "James", label: "2nd Year Uni" },
  { quote: "My AI coach explained concepts better than my textbook did.", name: "Sara", label: "A-Level Student" },
];

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollAnimation(0.1);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className} ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="grid-bg relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
        {/* Subtle radial glow behind hero */}
        <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-primary/[0.06] blur-3xl" />
        
        <div className="relative z-10 animate-fade-in mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] px-5 py-2 text-xs font-medium tracking-wide text-primary uppercase">
          AI-Powered Study Assistant
        </div>
        <h1 className="relative z-10 animate-fade-in max-w-[780px] text-5xl font-bold leading-[1.1] tracking-[-0.03em] text-foreground md:text-6xl" style={{ animationDelay: "100ms" }}>
          Turn your notes into a full study plan.{" "}
          <span className="text-gradient">Instantly.</span>
        </h1>
        <p className="relative z-10 animate-fade-in mt-6 max-w-lg text-base leading-7 text-muted-foreground" style={{ animationDelay: "200ms" }}>
          Upload your notes, set your test date. Note Pilot builds your study plan, flashcards, and personal AI coach automatically.
        </p>
        <div className="relative z-10 animate-fade-in mt-10" style={{ animationDelay: "300ms" }}>
          <Button variant="hero" asChild>
            <Link to="/auth" className="gap-2">Get Started Free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="relative z-10 animate-fade-in mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground" style={{ animationDelay: "500ms" }}>
          <span>500+ students</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>2 min setup</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>AI-generated plans</span>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1100px] px-6 py-24">
        <AnimatedSection>
          <p className="text-center text-sm font-medium uppercase tracking-widest text-primary mb-3">Features</p>
          <h2 className="text-center text-3xl font-bold text-foreground mb-14">Everything you need to ace your exams</h2>
        </AnimatedSection>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <AnimatedSection key={f.title} delay={i * 120}>
              <div className="glass-card group p-7 text-center hover:-translate-y-1.5 hover:border-primary/15">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-blue-soft transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/10">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="grid-bg py-24">
        <div className="mx-auto max-w-[1100px] px-6">
          <AnimatedSection>
            <p className="text-center text-sm font-medium uppercase tracking-widest text-primary mb-3">How It Works</p>
            <h2 className="text-center text-3xl font-bold text-foreground">From notes to study plan in minutes</h2>
          </AnimatedSection>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {steps.map((step, i) => (
              <AnimatedSection key={step.number} delay={i * 150}>
                <div className="group flex flex-col items-center text-center">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <AnimatedSection>
          <div className="mx-auto max-w-2xl text-center px-6">
            <h2 className="text-3xl font-bold text-foreground">Ready to study smarter?</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">Join hundreds of students already using Note Pilot to ace their exams.</p>
            <Button variant="hero" className="mt-8" asChild>
              <Link to="/auth" className="gap-2">Start Studying Now <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </AnimatedSection>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-surface-alt">
        <div className="mx-auto max-w-[1100px] px-6">
          <AnimatedSection>
            <p className="text-center text-sm font-medium uppercase tracking-widest text-primary mb-3">Testimonials</p>
            <h2 className="text-center text-3xl font-bold text-foreground">Built for students who want results</h2>
          </AnimatedSection>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <AnimatedSection key={t.name} delay={i * 120}>
                <div className="glass-card group p-7 hover:-translate-y-1 hover:border-primary/15">
                  <p className="text-sm leading-7 text-muted-foreground italic">"{t.quote}"</p>
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.label}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-10">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-4 md:flex-row">
          <img src={logo} alt="Note Pilot" className="h-20 w-20 object-contain" />
          <p className="text-xs text-muted-foreground">Built with AI</p>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Note Pilot</p>
        </div>
      </footer>
    </div>
  );
}
