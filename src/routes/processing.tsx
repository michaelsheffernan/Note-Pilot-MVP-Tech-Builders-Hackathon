import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { analyseNotes } from "@/server/analyse.functions";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

const statusMessages = [
  "Reading your notes...",
  "Identifying key topics...",
  "Building your study plan...",
  "Generating flashcards...",
  "Setting up your AI coach...",
];

const funFacts = [
  "Spaced repetition improves memory retention by up to 80%",
  "Students who plan their study sessions score 30% higher on average",
  "Active recall is the most effective study technique known to science",
];

export const Route = createFileRoute("/processing")({
  validateSearch: (search: Record<string, unknown>) => ({
    uploadId: search.uploadId as string,
  }),
  head: () => ({
    meta: [{ title: "Processing — Note Pilot" }],
  }),
  component: ProcessingPage,
});

function ProcessingPage() {
  const { uploadId } = Route.useSearch();
  const { user, loading, session } = useAuth();
  const navigate = useNavigate();
  const [msgIndex, setMsgIndex] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % statusMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex((i) => (i + 1) % funFacts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const start = Date.now();
    const duration = 35000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(95, (elapsed / duration) * 100));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!uploadId || !session || started.current) return;
    started.current = true;

    (async () => {
      try {
        const { data: upload } = await supabase
          .from("uploads")
          .select("*")
          .eq("id", uploadId)
          .single();

        if (!upload) throw new Error("Upload not found");

        // Retrieve extra context from localStorage
        let extraContext: Record<string, string> = {};
        try {
          const stored = localStorage.getItem(`upload_context_${uploadId}`);
          if (stored) {
            extraContext = JSON.parse(stored);
            localStorage.removeItem(`upload_context_${uploadId}`);
          }
        } catch { /* ignore */ }

        await analyseNotes({
          data: {
            uploadId: upload.id,
            subjectName: upload.subject_name,
            testDate: upload.test_date,
            fileUrl: upload.file_url,
            accessToken: session.access_token,
            extraContext,
          },
        });

        navigate({ to: "/dashboard", search: { uploadId } });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Processing failed");
        navigate({ to: "/upload" });
      }
    })();
  }, [uploadId, session, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center max-w-md w-full">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-foreground">Note Pilot</span>
        </div>

        <div className="relative mb-8">
          <BookOpen className="h-16 w-16 text-primary animate-pulse" />
        </div>
        <p className="text-xl font-medium text-foreground animate-pulse">
          {statusMessages[msgIndex]}
        </p>

        <div className="mt-6 w-full max-w-xs">
          <Progress value={progress} className="h-2" />
        </div>

        <div className="mt-4 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              style={{ animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          This usually takes 20–40 seconds
        </p>
        <p className="mt-6 rounded-xl bg-secondary/50 px-5 py-3 text-center text-xs text-muted-foreground italic transition-all duration-500">
          {funFacts[factIndex]}
        </p>
      </div>
    </div>
  );
}
