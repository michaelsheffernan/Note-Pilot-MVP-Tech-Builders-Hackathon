import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, Plus } from "lucide-react";
import { StudyPlanTab } from "@/components/StudyPlanTab";
import { FlashcardsTab } from "@/components/FlashcardsTab";
import { CoachTab } from "@/components/CoachTab";
import { differenceInDays, parseISO } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    uploadId: search.uploadId as string,
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — StudySync" },
      { name: "description", content: "Your personalised study dashboard." },
    ],
  }),
  component: DashboardPage,
});

type Tab = "plan" | "flashcards" | "coach";

interface StudyDay {
  day: number;
  date: string;
  topics: string[];
  estimated_minutes: number;
}

interface Flashcard {
  question: string;
  answer: string;
}

function DashboardPage() {
  const { uploadId } = Route.useSearch();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [upload, setUpload] = useState<{
    subject_name: string;
    test_date: string;
    file_text: string | null;
  } | null>(null);
  const [plan, setPlan] = useState<StudyDay[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !uploadId) return;

    const fetchData = async () => {
      const [uploadRes, planRes, cardsRes] = await Promise.all([
        supabase.from("uploads").select("subject_name, test_date, file_text").eq("id", uploadId).single(),
        supabase.from("study_plans").select("plan_json").eq("upload_id", uploadId).single(),
        supabase.from("flashcards").select("cards_json").eq("upload_id", uploadId).single(),
      ]);

      if (uploadRes.data) setUpload(uploadRes.data);
      if (planRes.data) setPlan(planRes.data.plan_json as unknown as StudyDay[]);
      if (cardsRes.data) setCards(cardsRes.data.cards_json as unknown as Flashcard[]);
      setDataLoading(false);
    };

    fetchData();
  }, [user, uploadId]);

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <BookOpen className="h-10 w-10 text-primary animate-pulse" />
      </div>
    );
  }

  const daysUntilTest = upload
    ? Math.max(0, differenceInDays(parseISO(upload.test_date), new Date()))
    : 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: "plan", label: "Study Plan" },
    { key: "flashcards", label: "Flashcards" },
    { key: "coach", label: "Coach" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-foreground">StudySync</span>
        </div>
        <div className="flex items-center gap-2 text-center">
          <span className="text-sm font-semibold text-foreground">{upload?.subject_name}</span>
          <span className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {daysUntilTest} day{daysUntilTest !== 1 ? "s" : ""} until test
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/upload" })}>
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="mb-6 flex rounded-xl bg-secondary p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "plan" && <StudyPlanTab plan={plan} />}
        {activeTab === "flashcards" && <FlashcardsTab cards={cards} />}
        {activeTab === "coach" && (
          <CoachTab
            noteContext={upload?.file_text ?? ""}
            subjectName={upload?.subject_name ?? ""}
            accessToken={session?.access_token ?? ""}
          />
        )}
      </div>
    </div>
  );
}
