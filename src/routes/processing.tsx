import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import logo from "@/assets/note-pilot-logo.png";
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
    <div className="grid-bg relative flex min-h-screen flex-col items-center justify-center px-4">
      {/* Background glow */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[500px] rounded-full bg-primary/[0.06] blur-3xl" />
      
      <div className="relative z-10 flex flex-col items-center max-w-md w-full">
        <div className="relative mb-10">
          <img src={logo} alt="Note Pilot" className="h-28 w-28 object-contain animate-pulse" />
          {/* Glow ring behind logo */}
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl scale-150" />
        </div>

        <p className="text-xl font-semibold text-foreground transition-all duration-500">
          {statusMessages[msgIndex]}
        </p>

        <div className="mt-8 w-full max-w-xs">
          <Progress value={progress} className="h-2" />
          <p className="mt-2 text-right text-xs text-muted-foreground">{Math.round(progress)}%</p>
        </div>

        <div className="mt-6 flex gap-2">
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

        <p className="mt-6 glass-card px-6 py-4 text-center text-xs text-muted-foreground italic leading-relaxed transition-all duration-500">
          {funFacts[factIndex]}
        </p>
      </div>
    </div>
  );
}
