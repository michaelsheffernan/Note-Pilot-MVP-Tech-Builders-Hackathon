import { useState } from "react";
import { Check, Clock, Calendar } from "lucide-react";
import { format, parseISO, isToday } from "date-fns";

interface StudyDay {
  day: number;
  date: string;
  topics: string[];
  estimated_minutes: number;
}

export function StudyPlanTab({ plan }: { plan: StudyDay[] }) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const toggleComplete = (day: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  if (!plan || plan.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No study plan generated yet.</p>;
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {plan.map((day) => {
        const isTodayCard = (() => {
          try { return isToday(parseISO(day.date)); } catch { return false; }
        })();
        const isDone = completed.has(day.day);

        return (
          <div
            key={day.day}
            className={`glass-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
              isDone ? "opacity-60" : ""
            } ${isTodayCard ? "border-primary ring-1 ring-primary/20" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-sm font-bold text-primary">Day {day.day}</span>
                  {isTodayCard && (
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      Today
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {day.date}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {day.estimated_minutes} min
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {day.topics.map((topic, i) => (
                    <span key={i} className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => toggleComplete(day.day)}
                className={`ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
