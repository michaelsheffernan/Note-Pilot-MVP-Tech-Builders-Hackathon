import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RefreshCw, Save, Calendar, BookOpen, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyseNotes } from "@/server/analyse.functions";
import { format, addDays, parseISO } from "date-fns";

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

interface StudyPlanDay {
  day: number;
  date: string;
  topics: string[];
  estimated_minutes: number;
}

interface StudyPlanSettingsProps {
  uploadId: string;
  subjectName: string;
  testDate: string;
  fileUrl: string;
  accessToken: string;
  preferences: StudyPreferences;
  onPreferencesUpdated: (prefs: StudyPreferences) => void;
  onPlanUpdated: () => void;
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

const weekdayMap: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function buildScheduledDates(studyDays: string, endDate: string, limit: number) {
  const allowedDays = studyDays
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean)
    .map((day) => weekdayMap[day])
    .filter((day): day is number => day !== undefined);

  const dates: string[] = [];
  const lastDate = parseISO(endDate);
  lastDate.setHours(12, 0, 0, 0);

  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  while (cursor <= lastDate && dates.length < limit) {
    if (!allowedDays.length || allowedDays.includes(cursor.getDay())) {
      dates.push(format(cursor, "yyyy-MM-dd"));
    }
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function reschedulePlanDates(plan: StudyPlanDay[], studyDays: string, endDate: string) {
  const scheduledDates = buildScheduledDates(studyDays, endDate, plan.length);

  if (!scheduledDates.length) {
    return plan;
  }

  return plan.slice(0, scheduledDates.length).map((entry, index) => ({
    ...entry,
    day: index + 1,
    date: scheduledDates[index],
  }));
}

export function StudyPlanSettings({
  uploadId,
  subjectName,
  testDate,
  fileUrl,
  accessToken,
  preferences,
  onPreferencesUpdated,
  onPlanUpdated,
  onPlanRegenerated,
}: StudyPlanSettingsProps) {
  const [prefs, setPrefs] = useState<StudyPreferences>({ ...preferences });
  const [editTestDate, setEditTestDate] = useState(testDate);
  const [editSubject, setEditSubject] = useState(subjectName);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const selectedDays = prefs.studyDays ? prefs.studyDays.split(",").filter(Boolean) : [];

  const buildUpdatedPrefs = (nextPrefs: StudyPreferences) => {
    const nextSelectedDays = nextPrefs.studyDays ? nextPrefs.studyDays.split(",").filter(Boolean) : [];
    return {
      ...nextPrefs,
      daysPerWeek: String(nextSelectedDays.length || 5),
    };
  };

  const toggleDay = (day: string) => {
    const updated = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];

    setPrefs({ ...prefs, studyDays: updated.join(",") });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedPrefs = buildUpdatedPrefs(prefs);

      const { error } = await supabase
        .from("uploads")
        .update({
          subject_name: editSubject.trim(),
          test_date: editTestDate,
          preferences: updatedPrefs as any,
        })
        .eq("id", uploadId);
      if (error) throw error;

      const { data: existingPlan, error: planFetchError } = await supabase
        .from("study_plans")
        .select("id, plan_json")
        .eq("upload_id", uploadId)
        .maybeSingle();
      if (planFetchError) throw planFetchError;

      if (existingPlan && Array.isArray(existingPlan.plan_json)) {
        const updatedPlan = reschedulePlanDates(
          existingPlan.plan_json as unknown as StudyPlanDay[],
          updatedPrefs.studyDays,
          editTestDate,
        );

        const { error: planUpdateError } = await supabase
          .from("study_plans")
          .update({ plan_json: updatedPlan as any })
          .eq("id", existingPlan.id);
        if (planUpdateError) throw planUpdateError;
      }

      onPreferencesUpdated(updatedPrefs);
      onPlanUpdated();
      toast.success("Settings saved and calendar updated!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const updatedPrefs = buildUpdatedPrefs(prefs);

      await supabase
        .from("uploads")
        .update({
          subject_name: editSubject.trim(),
          test_date: editTestDate,
          preferences: updatedPrefs as any,
        })
        .eq("id", uploadId);

      await Promise.all([
        supabase.from("study_plans").delete().eq("upload_id", uploadId),
        supabase.from("flashcards").delete().eq("upload_id", uploadId),
      ]);

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
        "Save Changes" updates your study details and reschedules calendar dates. "Regenerate Plan" rebuilds the plan and flashcards using AI.
      </p>
    </div>
  );
}
