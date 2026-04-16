import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import logo from "@/assets/note-pilot-logo.png";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CalendarStudyPlan } from "@/components/CalendarStudyPlan";
import { FlashcardsTab } from "@/components/FlashcardsTab";
import { CoachTab } from "@/components/CoachTab";
import { NotesTab } from "@/components/NotesTab";
import { StudyPlanSettings, type StudyPreferences } from "@/components/StudyPlanSettings";
import { Progress } from "@/components/ui/progress";
import { differenceInDays, parseISO } from "date-fns";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    uploadId: search.uploadId as string,
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — Note Pilot" },
      { name: "description", content: "Your personalised study dashboard." },
    ],
  }),
  component: DashboardPage,
});

type Tab = "plan" | "notes" | "flashcards" | "coach" | "settings";

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

const defaultPrefs: StudyPreferences = {
  studyMode: "deadline",
  examType: "mixed",
  difficulty: "intermediate",
  studyHours: "1",
  studyStyle: "mixed",
  focusAreas: "",
  weakTopics: "",
  additionalNotes: "",
  daysPerWeek: "5",
  studyDays: "",
};

function DashboardPage() {
  const { uploadId } = Route.useSearch();
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [upload, setUpload] = useState<{
    subject_name: string;
    test_date: string;
    file_text: string | null;
    file_url: string;
    created_at: string;
    preferences: StudyPreferences | null;
  } | null>(null);
  const [plan, setPlan] = useState<StudyDay[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [preferences, setPreferences] = useState<StudyPreferences>(defaultPrefs);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const fetchAllData = async () => {
    if (!user || !uploadId) return;
    const [uploadRes, planRes, cardsRes] = await Promise.all([
      supabase.from("uploads").select("subject_name, test_date, file_text, file_url, created_at, preferences").eq("id", uploadId).single(),
      supabase.from("study_plans").select("plan_json").eq("upload_id", uploadId).single(),
      supabase.from("flashcards").select("cards_json").eq("upload_id", uploadId).single(),
    ]);
    if (uploadRes.data) {
      setUpload(uploadRes.data as any);
      if (uploadRes.data.preferences && typeof uploadRes.data.preferences === "object") {
        setPreferences({ ...defaultPrefs, ...(uploadRes.data.preferences as any) });
      }
    }
    if (planRes.data) setPlan(planRes.data.plan_json as unknown as StudyDay[]);
    if (cardsRes.data) setCards(cardsRes.data.cards_json as unknown as Flashcard[]);
    setDataLoading(false);
  };

  useEffect(() => {
    fetchAllData();
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
    { key: "settings", label: "Settings" },
  ];

  const statCards = [
    { value: daysUntilTest, label: "Days Left", suffix: "" },
    { value: `${completedCount}/${totalDays}`, label: "Days Done", suffix: "" },
    { value: cards.length, label: "Flashcards", suffix: "" },
    { value: Math.round(totalMinutes / 60), label: "Total Study", suffix: "h" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/studies" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Link to="/studies"><img src={logo} alt="Note Pilot" className="h-28 w-28 object-contain" /></Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/upload" })}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Subject header */}
        <div className="mb-8">
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{upload?.subject_name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {daysUntilTest} day{daysUntilTest !== 1 ? "s" : ""} until your exam
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCards.map((stat) => (
              <div key={stat.label} className="glass-card p-4 text-center group hover:-translate-y-0.5">
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {stat.value}
                  {stat.suffix && <span className="text-sm font-normal text-muted-foreground">{stat.suffix}</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="mt-5 flex items-center gap-3">
            <Progress value={progressPct} className="h-2 flex-1" />
            <span className="text-xs font-semibold text-primary whitespace-nowrap tabular-nums">{progressPct}%</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-secondary/80 p-1 backdrop-blur-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
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
                supabase.from("uploads").select("subject_name, test_date, file_text, file_url, created_at, preferences").eq("id", uploadId).single().then(({ data }) => {
                  if (data) setUpload(data as any);
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
              studyPlan={plan}
            />
          )}
          {activeTab === "settings" && (
            <StudyPlanSettings
              uploadId={uploadId}
              subjectName={upload?.subject_name ?? ""}
              testDate={upload?.test_date ?? ""}
              fileUrl={upload?.file_url ?? ""}
              accessToken={session?.access_token ?? ""}
              preferences={preferences}
              onPreferencesUpdated={(prefs) => setPreferences(prefs)}
              onPlanUpdated={() => {
                fetchAllData();
              }}
              onPlanRegenerated={() => {
                fetchAllData();
                setActiveTab("plan");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
