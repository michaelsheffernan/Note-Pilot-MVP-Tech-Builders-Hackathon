import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import logo from "@/assets/note-pilot-logo.png";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, Trash2 } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { differenceInDays, parseISO, format } from "date-fns";
import { toast } from "sonner";
import { MasterCalendar, type MasterStudyDay } from "@/components/MasterCalendar";

export const Route = createFileRoute("/studies")({
  head: () => ({
    meta: [
      { title: "My Studies — Note Pilot" },
      { name: "description", content: "View all your study plans." },
    ],
  }),
  component: StudiesPage,
});

interface UploadRow {
  id: string;
  subject_name: string;
  test_date: string;
  created_at: string;
  file_url: string;
}

interface PlanRow {
  upload_id: string;
  plan_json: unknown;
}

function StudiesPage() {
  const { user, loading } = useAuth();
  const { displayName } = useProfile();
  const navigate = useNavigate();
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [uploadsRes, plansRes] = await Promise.all([
        supabase
          .from("uploads")
          .select("id, subject_name, test_date, created_at, file_url")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("study_plans")
          .select("upload_id, plan_json")
          .eq("user_id", user.id),
      ]);
      if (uploadsRes.data) setUploads(uploadsRes.data);
      if (plansRes.data) setPlans(plansRes.data as PlanRow[]);
      setDataLoading(false);
    })();
  }, [user]);

  const masterDays: MasterStudyDay[] = useMemo(() => {
    const result: MasterStudyDay[] = [];
    for (const plan of plans) {
      const upload = uploads.find((u) => u.id === plan.upload_id);
      if (!upload) continue;
      const days = plan.plan_json as Array<{ day: number; date: string; topics: string[]; estimated_minutes: number }>;
      if (!Array.isArray(days)) continue;
      for (const d of days) {
        result.push({
          date: d.date,
          subject: upload.subject_name,
          uploadId: upload.id,
          topics: d.topics || [],
          estimated_minutes: d.estimated_minutes || 0,
        });
      }
    }
    return result;
  }, [uploads, plans]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("uploads").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    setUploads((prev) => prev.filter((u) => u.id !== id));
    setPlans((prev) => prev.filter((p) => p.upload_id !== id));
    toast.success("Study plan deleted");
  };

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-3">
          <Link to="/"><img src={logo} alt="Note Pilot" className="h-28 w-28 object-contain" /></Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/upload" })}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {displayName ? `${displayName}'s Studies` : "My Studies"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">All your study plans in one place</p>
        </div>

        {/* Master Calendar */}
        {masterDays.length > 0 && (
          <div className="mb-10">
            <h2 className="text-base font-semibold text-foreground mb-3">Study Calendar</h2>
            <div className="glass-card p-5">
              <MasterCalendar
                days={masterDays}
                onOpenStudy={(uploadId) => navigate({ to: "/dashboard", search: { uploadId } })}
              />
            </div>
          </div>
        )}

        {uploads.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-muted-foreground mb-4">You haven't created any study plans yet.</p>
            <Button onClick={() => navigate({ to: "/upload" })} size="lg">
              <Plus className="h-4 w-4 mr-1" /> Create Your First Plan
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {uploads.map((upload, i) => {
              const daysUntilTest = Math.max(0, differenceInDays(parseISO(upload.test_date), new Date()));
              const isPast = daysUntilTest === 0;

              return (
                <div
                  key={upload.id}
                  className="glass-card group flex items-center justify-between p-5 hover:-translate-y-0.5 animate-fade-in"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <Link
                    to="/dashboard"
                    search={{ uploadId: upload.id }}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary transition-colors group-hover:bg-primary/15">
                        {upload.subject_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{upload.subject_name}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(upload.created_at), "MMM d, yyyy")}
                          </span>
                          <span className={`text-xs font-medium ${isPast ? "text-muted-foreground" : "text-primary"}`}>
                            {isPast ? "Exam passed" : `${daysUntilTest} day${daysUntilTest !== 1 ? "s" : ""} left`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.preventDefault(); handleDelete(upload.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Link to="/dashboard" search={{ uploadId: upload.id }}>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
