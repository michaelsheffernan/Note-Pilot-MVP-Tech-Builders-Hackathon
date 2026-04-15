import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { analyseNotes } from "@/server/analyse.functions";
import { supabase } from "@/integrations/supabase/client";

const statusMessages = [
  "Reading your notes...",
  "Identifying key topics...",
  "Building your study plan...",
  "Generating flashcards...",
  "Setting up your AI coach...",
];

export const Route = createFileRoute("/processing")({
  validateSearch: (search: Record<string, unknown>) => ({
    uploadId: search.uploadId as string,
  }),
  head: () => ({
    meta: [{ title: "Processing — StudySync" }],
  }),
  component: ProcessingPage,
});

function ProcessingPage() {
  const { uploadId } = Route.useSearch();
  const { user, loading, session } = useAuth();
  const navigate = useNavigate();
  const [msgIndex, setMsgIndex] = useState(0);
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

        await analyseNotes({
          data: {
            uploadId: upload.id,
            subjectName: upload.subject_name,
            testDate: upload.test_date,
            fileUrl: upload.file_url,
            accessToken: session.access_token,
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
      <div className="flex flex-col items-center">
        <div className="relative mb-8">
          <BookOpen className="h-16 w-16 text-primary animate-pulse" />
        </div>
        <p className="text-xl font-medium text-foreground animate-pulse">
          {statusMessages[msgIndex]}
        </p>
        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              style={{
                animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Please don't navigate away — this may take a minute
        </p>
      </div>
    </div>
  );
}
