import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, RefreshCw, Save, Calendar, Clock, BookOpen, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyseNotes } from "@/server/analyse.functions";
import { format } from "date-fns";

export interface StudyPreferences {
  studyMode: string;
  examType: string;
  difficulty: string;
  studyHours: string;
  studyStyle: string;
  focusAreas: string;
  weakTopics: string;
  additionalNotes: string;
  daysPerWeek: string;
  studyDays: string;
  studyDuration?: string;
  studyGoal?: string;
  studentName?: string;
}

interface StudyPlanSettingsProps {
  uploadId: string;
  subjectName: string;
  testDate: string;
  fileUrl: string;
  accessToken: string;
  preferences: StudyPreferences;
  onPreferencesUpdated: (prefs: StudyPreferences) => void;
  onPlanRegenerated: () => void;
}

const examTypes = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "essay", label: "Essay / Written" },
  { value: "practical", label: "Practical / Lab" },
  { value: "mixed", label: "Mixed Format" },
  { value: "general_study", label: "General Study" },
];

const difficultyLevels = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const studyHoursOptions = [
  { value: "0.5", label: "30 min" },
  { value: "1", label: "1 hr" },
  { value: "2", label: "2 hrs" },
  { value: "3", label: "3+ hrs" },
];

const studyStyleOptions = [
  { value: "visual", label: "Visual" },
  { value: "reading", label: "Reading/Writing" },
  { value: "practice", label: "Practice" },
  { value: "mixed", label: "Mix of all" },
];

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function StudyPlanSettings({
  uploadId,
  subjectName,
  testDate,
  fileUrl,
  accessToken,
  preferences,
  onPreferencesUpdated,
  onPlanRegenerated,
}: StudyPlanSettingsProps) {
  const [prefs, setPrefs] = useState<StudyPreferences>({ ...preferences });
  const [editTestDate, setEditTestDate] = useState(testDate);
  const [editSubject, setEditSubject] = useState(subjectName);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const selectedDays = prefs.studyDays ? prefs.studyDays.split(",").filter(Boolean) : [];

  const toggleDay = (day: string) => {
    const current = selectedDays;
    const updated = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setPrefs({ ...prefs, studyDays: updated.join(",") });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("uploads")
        .update({
          subject_name: editSubject.trim(),
          test_date: editTestDate,
          preferences: prefs as any,
        })
        .eq("id", uploadId);
      if (error) throw error;
      onPreferencesUpdated(prefs);
      toast.success("Settings saved!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      // Derive daysPerWeek from selected study days
      const currentSelectedDays = prefs.studyDays ? prefs.studyDays.split(",").filter(Boolean) : [];
      const updatedPrefs = { ...prefs, daysPerWeek: String(currentSelectedDays.length || 5) };

      // Save first
      await supabase
        .from("uploads")
        .update({
          subject_name: editSubject.trim(),
          test_date: editTestDate,
          preferences: updatedPrefs as any,
        })
        .eq("id", uploadId);

      // Delete old plan & flashcards
      await Promise.all([
        supabase.from("study_plans").delete().eq("upload_id", uploadId),
        supabase.from("flashcards").delete().eq("upload_id", uploadId),
      ]);

      // Regenerate
      await analyseNotes({
        data: {
          uploadId,
          subjectName: editSubject.trim(),
          testDate: editTestDate,
          fileUrl,
          accessToken,
          extraContext: updatedPrefs as unknown as Record<string, string>,
        },
      });

      onPreferencesUpdated(updatedPrefs);
      onPlanRegenerated();
      toast.success("Study plan regenerated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate plan");
    } finally {
      setRegenerating(false);
    }
  };

  const OptionButton = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-sm transition-all duration-200 hover:border-primary/50 ${
        selected ? "border-primary bg-primary/5 text-foreground font-medium" : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Core Details */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Study Details</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="editSubject">Subject Name</Label>
            <Input id="editSubject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="editTestDate">
              {prefs.studyMode === "duration" ? "End Date" : "Test / Exam Date"}
            </Label>
            <Input
              id="editTestDate"
              type="date"
              value={editTestDate}
              onChange={(e) => setEditTestDate(e.target.value)}
              className="mt-1"
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>
          <div>
            <Label className="mb-2 block">Exam Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {examTypes.map((et) => (
                <OptionButton key={et.value} selected={prefs.examType === et.value} onClick={() => setPrefs({ ...prefs, examType: et.value })}>
                  {et.label}
                </OptionButton>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Knowledge Level</Label>
            <div className="grid grid-cols-3 gap-2">
              {difficultyLevels.map((d) => (
                <OptionButton key={d.value} selected={prefs.difficulty === d.value} onClick={() => setPrefs({ ...prefs, difficulty: d.value })}>
                  {d.label}
                </OptionButton>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Schedule */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Schedule</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Daily Study Time</Label>
            <div className="grid grid-cols-4 gap-2">
              {studyHoursOptions.map((h) => (
                <OptionButton key={h.value} selected={prefs.studyHours === h.value} onClick={() => setPrefs({ ...prefs, studyHours: h.value })}>
                  {h.label}
                </OptionButton>
              ))}
            </div>
          </div>
          {/* Days per week derived from selected study days */}
          <div>
            <Label className="mb-2 block">Study Days</Label>
            <div className="grid grid-cols-4 gap-2">
              {weekDays.map((day) => (
                <OptionButton key={day} selected={selectedDays.includes(day)} onClick={() => toggleDay(day)}>
                  {day.slice(0, 3)}
                </OptionButton>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Learning Style</Label>
            <div className="grid grid-cols-2 gap-2">
              {studyStyleOptions.map((s) => (
                <OptionButton key={s.value} selected={prefs.studyStyle === s.value} onClick={() => setPrefs({ ...prefs, studyStyle: s.value })}>
                  {s.label}
                </OptionButton>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Focus Areas */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Focus Areas</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="focusAreas">Topics to Focus On <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="focusAreas" value={prefs.focusAreas} onChange={(e) => setPrefs({ ...prefs, focusAreas: e.target.value })} placeholder="e.g. Photosynthesis, Cell Division" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="weakTopics">Weak Topics <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="weakTopics" value={prefs.weakTopics} onChange={(e) => setPrefs({ ...prefs, weakTopics: e.target.value })} placeholder="Topics you struggle with" className="mt-1" />
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} variant="outline" className="flex-1 gap-2">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button onClick={handleRegenerate} disabled={regenerating} className="flex-1 gap-2">
          <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating..." : "Regenerate Plan"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        "Save Changes" updates settings only. "Regenerate Plan" will create a new study plan and flashcards using AI.
      </p>
    </div>
  );
}
