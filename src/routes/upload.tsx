import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText, BookOpen, LogOut, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
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

const fileTypes = ["PDF", "DOCX", "JPG", "PNG"];

const examTypes = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "essay", label: "Essay / Written" },
  { value: "practical", label: "Practical / Lab" },
  { value: "mixed", label: "Mixed Format" },
];

const difficultyLevels = [
  { value: "beginner", label: "Beginner", desc: "Just starting this subject" },
  { value: "intermediate", label: "Intermediate", desc: "Some prior knowledge" },
  { value: "advanced", label: "Advanced", desc: "Strong foundation" },
];

const studyHoursOptions = [
  { value: "0.5", label: "30 min/day" },
  { value: "1", label: "1 hr/day" },
  { value: "2", label: "2 hrs/day" },
  { value: "3", label: "3+ hrs/day" },
];

const studyStyleOptions = [
  { value: "visual", label: "Visual", desc: "Diagrams, charts" },
  { value: "reading", label: "Reading/Writing", desc: "Notes, summaries" },
  { value: "practice", label: "Practice", desc: "Exercises, past papers" },
  { value: "mixed", label: "Mix of all", desc: "All styles" },
];

function UploadPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [subjectName, setSubjectName] = useState("");
  const [testDate, setTestDate] = useState("");
  const [examType, setExamType] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const [studyHours, setStudyHours] = useState("");
  const [studyStyle, setStudyStyle] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [weakTopics, setWeakTopics] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  }, []);

  const canProceedStep1 = !!file;
  const canProceedStep2 = subjectName.trim() && testDate && examType && difficulty;
  const canProceedStep3 = studyHours && studyStyle;

  const handleSubmit = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("notes").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: uploadData, error: insertError } = await supabase
        .from("uploads")
        .insert({ user_id: user.id, file_url: filePath, subject_name: subjectName, test_date: testDate })
        .select()
        .single();
      if (insertError) throw insertError;

      const extraContext = { examType, difficulty, studyHours, studyStyle, focusAreas, weakTopics, additionalNotes };
      localStorage.setItem(`upload_context_${uploadData.id}`, JSON.stringify(extraContext));

      navigate({ to: "/processing", search: { uploadId: uploadData.id } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  if (loading) return null;

  const stepProgress = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="text-xl font-bold text-foreground">StudySync</span>
        <Button variant="ghost" onClick={signOut} size="sm">
          <LogOut className="h-4 w-4 mr-1" /> Sign Out
        </Button>
      </header>

      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Step {step} of {totalSteps}</span>
            <span className="text-xs font-medium text-primary">{Math.round(stepProgress)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${stepProgress}%` }} />
          </div>
        </div>

        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground">Upload Your Notes</h1>
              <p className="mt-2 text-sm text-muted-foreground">AI will read your notes and build everything automatically</p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`glass-card flex cursor-pointer flex-col items-center justify-center p-12 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${dragOver ? "border-primary bg-primary/5 scale-[1.02]" : ""}`}
            >
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <span className="text-foreground font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs text-primary hover:underline">Change file</button>
                </div>
              ) : (
                <>
                  <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium">Drag and drop your notes here</p>
                  <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
                  <div className="mt-4 flex gap-2">
                    {fileTypes.map((t) => (
                      <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full gap-2" size="lg">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground">About Your Exam</h1>
              <p className="mt-2 text-sm text-muted-foreground">Help us personalise your study plan</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject Name</Label>
                <Input id="subject" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g. Biology, Organic Chemistry" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="testDate">Test / Exam Date</Label>
                <Input id="testDate" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="mt-1" min={format(new Date(), "yyyy-MM-dd")} />
              </div>
              <div>
                <Label className="mb-2 block">Exam Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {examTypes.map((et) => (
                    <button key={et.value} onClick={() => setExamType(et.value)}
                      className={`rounded-xl border p-3 text-sm transition-all duration-200 hover:border-primary/50 ${examType === et.value ? "border-primary bg-primary/5 text-foreground font-medium" : "border-border text-muted-foreground"}`}
                    >{et.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Your Knowledge Level</Label>
                <div className="space-y-2">
                  {difficultyLevels.map((d) => (
                    <button key={d.value} onClick={() => setDifficulty(d.value)}
                      className={`w-full rounded-xl border p-3 text-left transition-all duration-200 hover:border-primary/50 ${difficulty === d.value ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <span className="text-sm font-medium text-foreground">{d.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{d.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="flex-1 gap-2" size="lg">Continue <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground">Study Preferences</h1>
              <p className="mt-2 text-sm text-muted-foreground">Fine-tune your personalised plan</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Daily Study Time</Label>
                <div className="grid grid-cols-2 gap-2">
                  {studyHoursOptions.map((h) => (
                    <button key={h.value} onClick={() => setStudyHours(h.value)}
                      className={`rounded-xl border p-3 text-sm transition-all duration-200 hover:border-primary/50 ${studyHours === h.value ? "border-primary bg-primary/5 text-foreground font-medium" : "border-border text-muted-foreground"}`}
                    >{h.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Learning Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  {studyStyleOptions.map((s) => (
                    <button key={s.value} onClick={() => setStudyStyle(s.value)}
                      className={`rounded-xl border p-3 text-left transition-all duration-200 hover:border-primary/50 ${studyStyle === s.value ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <span className="text-sm font-medium text-foreground">{s.label}</span>
                      <br /><span className="text-xs text-muted-foreground">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="focus">Topics to Focus On <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="focus" value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} placeholder="e.g. Chapter 5, Cell Division" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="weak">Topics You Struggle With <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="weak" value={weakTopics} onChange={(e) => setWeakTopics(e.target.value)} placeholder="e.g. Organic reactions, Integration" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="notes">Anything Else? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <textarea id="notes" value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="e.g. I learn best in mornings, need extra practice..."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={handleSubmit} disabled={!canProceedStep3 || uploading} className="flex-1 gap-2" size="lg">
                <Sparkles className="h-4 w-4" />
                {uploading ? "Generating..." : "Generate My Study Plan"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
