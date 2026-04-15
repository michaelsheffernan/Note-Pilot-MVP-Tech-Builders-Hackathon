import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, MessageCircle, Layers, Upload, Calendar, Sparkles, Users, Clock, Zap, Quote } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudySync — Turn Your Notes Into a Study Plan" },
      { name: "description", content: "Upload your notes, set your test date. StudySync builds your study plan, flashcards, and personal AI coach automatically." },
      { property: "og:title", content: "StudySync — Turn Your Notes Into a Study Plan" },
      { property: "og:description", content: "AI-powered study assistant that creates personalised study plans from your notes." },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: BookOpen,
    title: "AI Study Plan",
    description: "Day-by-day schedule built from your notes",
  },
  {
    icon: Layers,
    title: "Smart Flashcards",
    description: "Auto-generated from your exact content",
  },
  {
    icon: MessageCircle,
    title: "AI Coach",
    description: "Ask questions. Get answers from your notes.",
  },
];

const steps = [
  {
    number: 1,
    title: "Upload Your Notes",
    description: "Drop in any PDF, DOCX or image. We handle the rest.",
  },
  {
    number: 2,
    title: "Set Your Test Date",
    description: "Tell us when your exam is. StudySync builds around your schedule.",
  },
  {
    number: 3,
    title: "Start Studying",
    description: "Get your personalised plan, flashcards and AI coach instantly.",
  },
];

const testimonials = [
  {
    quote: "StudySync turned my messy biology notes into a full 2-week plan. Incredible.",
    name: "Aoife",
    label: "Leaving Cert",
  },
  {
    quote: "The flashcards alone saved me hours. Actually studied smarter for once.",
    name: "James",
    label: "2nd Year Uni",
  },
  {
    quote: "My AI coach explained concepts better than my textbook did.",
    name: "Sara",
    label: "A-Level Student",
  },
];

const stats = [
  { icon: Users, label: "500+ Students" },
  { icon: Clock, label: "2min Setup" },
  { icon: Zap, label: "AI-Generated Plans" },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="grid-bg flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          AI-Powered Study Assistant
        </div>
        <h1 className="max-w-[800px] text-5xl font-semibold leading-[56px] tracking-[-0.02em] text-foreground md:text-6xl lg:text-[48px]">
          Turn your notes into a full study plan.{" "}
          <span className="text-primary">Instantly.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-6 text-muted-foreground">
          Upload your notes, set your test date. StudySync builds your study plan, flashcards, and personal AI coach automatically.
        </p>
        <Button variant="hero" className="mt-10" asChild>
          <Link to="/auth">Get Started Free</Link>
        </Button>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm">
              <s.icon className="h-3.5 w-3.5 text-primary" />
              {s.label}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1200px] px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass-card p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-blue-soft">
                <f.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="grid-bg py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <h2 className="text-center text-3xl font-bold text-foreground">From notes to study plan in minutes</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-5 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <h2 className="text-center text-3xl font-bold text-foreground">Built for students who want results</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="glass-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <Quote className="mb-3 h-5 w-5 text-primary/40" />
                <p className="text-sm leading-6 text-muted-foreground italic">"{t.quote}"</p>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">StudySync</span>
          </div>
          <p className="text-xs text-muted-foreground">Built with AI</p>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} StudySync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
