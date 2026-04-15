import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText, BookOpen, LogOut, Sparkles, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Notes — StudySync" },
      { name: "description", content: "Upload your study notes to generate a personalised study plan." },
    ],
  }),
  component: UploadPage,
});

const tips = [
  "Upload clear, readable notes",
  "Include headings and key terms",
  "More detail = better study plan",
];

const fileTypes = ["PDF", "DOCX", "JPG", "PNG"];

function UploadPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [testDate, setTestDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;

    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("notes")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: uploadData, error: insertError } = await supabase
        .from("uploads")
        .insert({
          user_id: user.id,
          file_url: filePath,
          subject_name: subjectName,
          test_date: testDate,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      navigate({ to: "/processing", search: { uploadId: uploadData.id } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  const isReady = file && subjectName.trim() && testDate;

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-foreground">StudySync</span>
        </div>
        <Button variant="ghost" onClick={signOut} className="gap-2">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </header>

      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground text-center">Upload Your Notes</h1>
        <p className="mt-2 text-center text-muted-foreground text-sm">
          AI will read your notes and build everything automatically
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`glass-card flex cursor-pointer flex-col items-center justify-center p-10 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
              dragOver ? "border-primary bg-primary/5" : ""
            }`}
          >
            {file ? (
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <span className="text-foreground font-medium">{file.name}</span>
              </div>
            ) : (
              <>
                <UploadCloud className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-foreground font-medium">Drag and drop your notes here</p>
                <p className="mt-1 text-xs text-muted-foreground">Supports PDF, DOCX, JPG, PNG</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {fileTypes.map((t) => (
              <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                {t}
              </span>
            ))}
          </div>

          <div>
            <Label htmlFor="subject">Subject Name</Label>
            <Input
              id="subject"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Biology 101"
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="testDate">Test Date</Label>
            <Input
              id="testDate"
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="mt-1"
              min={format(new Date(), "yyyy-MM-dd")}
              required
            />
          </div>

          <Button type="submit" className="w-full gap-2" size="lg" disabled={!isReady || uploading}>
            <Sparkles className="h-4 w-4" />
            {uploading ? "Uploading..." : "Generate My Study Plan"}
          </Button>
        </form>

        {/* Tips */}
        <div className="mt-12">
          <h3 className="text-center text-sm font-semibold text-foreground mb-4">Tips for best results</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {tips.map((tip) => (
              <div key={tip} className="flex items-start gap-2 rounded-xl bg-secondary/50 p-3">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs text-muted-foreground">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
