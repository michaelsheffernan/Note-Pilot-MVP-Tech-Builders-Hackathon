import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, MessageCircle } from "lucide-react";

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
    icon: Brain,
    title: "Smart Flashcards",
    description: "Auto-generated from your exact content",
  },
  {
    icon: MessageCircle,
    title: "AI Coach",
    description: "Ask questions. Get answers from your notes.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="grid-bg flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
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
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-blue-soft">
                <f.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
