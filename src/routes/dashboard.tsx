import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, ArrowLeft } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { CalendarStudyPlan } from "@/components/CalendarStudyPlan";
import { FlashcardsTab } from "@/components/FlashcardsTab";
import { CoachTab } from "@/components/CoachTab";
import { NotesTab } from "@/components/NotesTab";
import { Progress } from "@/components/ui/progress";
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

type Tab = "plan" | "notes" | "flashcards" | "coach";

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
  const { user, session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [upload, setUpload] = useState<{
    subject_name: string;
    test_date: string;
    file_text: string | null;
    file_url: string;
    created_at: string;
  } | null>(null);
  const [plan, setPlan] = useState<StudyDay[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !uploadId) return;
    const fetchData = async () => {
      const [uploadRes, planRes, cardsRes] = await Promise.all([
        supabase.from("uploads").select("subject_name, test_date, file_text, file_url, created_at").eq("id", uploadId).single(),
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

  const toggleComplete = (day: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const handleEditDay = (day: number, updates: { topics: string[]; estimated_minutes: number }) => {
    setPlan((prev) => prev.map((d) => d.day === day ? { ...d, ...updates } : d));
  };

  const handleDeleteDay = (day: number) => {
    setPlan((prev) => prev.filter((d) => d.day !== day));
  };

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const daysUntilTest = upload ? Math.max(0, differenceInDays(parseISO(upload.test_date), new Date())) : 0;
  const totalDays = plan.length;
  const completedCount = completed.size;
  const totalMinutes = plan.reduce((sum, d) => sum + d.estimated_minutes, 0);
  const progressPct = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: "plan", label: "Study Plan" },
    { key: "notes", label: "Notes" },
    { key: "flashcards", label: "Flashcards" },
    { key: "coach", label: "AI Coach" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/studies" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="text-xl font-bold text-foreground">StudySync</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/upload" })}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* Subject header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{upload?.subject_name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {daysUntilTest} day{daysUntilTest !== 1 ? "s" : ""} until your exam
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{daysUntilTest}</p>
              <p className="text-xs text-muted-foreground mt-1">Days Left</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{completedCount}<span className="text-sm font-normal text-muted-foreground">/{totalDays}</span></p>
              <p className="text-xs text-muted-foreground mt-1">Days Done</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{cards.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Flashcards</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{Math.round(totalMinutes / 60)}<span className="text-sm font-normal text-muted-foreground">h</span></p>
              <p className="text-xs text-muted-foreground mt-1">Total Study</p>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4 flex items-center gap-3">
            <Progress value={progressPct} className="h-2 flex-1" />
            <span className="text-xs font-medium text-primary whitespace-nowrap">{progressPct}% complete</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-secondary p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="animate-fade-in">
          {activeTab === "plan" && (
            <CalendarStudyPlan plan={plan} completed={completed} onToggleComplete={toggleComplete} onEditDay={handleEditDay} onDeleteDay={handleDeleteDay} />
          )}
          {activeTab === "notes" && (
            <NotesTab
              uploadId={uploadId}
              fileText={upload?.file_text ?? ""}
              fileUrl={upload?.file_url ?? ""}
              subjectName={upload?.subject_name ?? ""}
              accessToken={session?.access_token ?? ""}
              onPlanUpdated={() => {
                supabase.from("uploads").select("subject_name, test_date, file_text, file_url, created_at").eq("id", uploadId).single().then(({ data }) => {
                  if (data) setUpload(data);
                });
              }}
            />
          )}
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
    </div>
  );
}
