import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudyDay {
  day: number;
  date: string;
  topics: string[];
  estimated_minutes: number;
}

export function CalendarStudyPlan({ plan, completed, onToggleComplete }: {
  plan: StudyDay[];
  completed: Set<number>;
  onToggleComplete: (day: number) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<StudyDay | null>(null);

  // Map dates to study days
  const dateMap = useMemo(() => {
    const map = new Map<string, StudyDay>();
    plan.forEach((d) => {
      map.set(d.date, d);
    });
    return map;
  }, [plan]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</h3>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 bg-secondary/50">
          {weekDays.map((wd) => (
            <div key={wd} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {wd}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-t border-border">
            {week.map((date, di) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const studyDay = dateMap.get(dateStr);
              const inMonth = isSameMonth(date, currentMonth);
              const today = isToday(date);
              const isDone = studyDay && completed.has(studyDay.day);
              const isSelected = selectedDay && studyDay && selectedDay.day === studyDay.day;

              return (
                <button
                  key={di}
                  onClick={() => studyDay && setSelectedDay(isSelected ? null : studyDay)}
                  className={`relative min-h-[72px] border-r border-border p-1.5 text-left transition-all duration-150 last:border-r-0
                    ${!inMonth ? "bg-secondary/20" : "hover:bg-secondary/40"}
                    ${today ? "bg-primary/5" : ""}
                    ${isSelected ? "ring-2 ring-primary ring-inset" : ""}
                  `}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs
                    ${today ? "bg-primary text-primary-foreground font-bold" : inMonth ? "text-foreground" : "text-muted-foreground/40"}
                  `}>
                    {format(date, "d")}
                  </span>

                  {studyDay && inMonth && (
                    <div className="mt-0.5 space-y-0.5">
                      {studyDay.topics.slice(0, 2).map((topic, ti) => (
                        <div
                          key={ti}
                          className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium
                            ${isDone
                              ? "bg-primary/10 text-primary/50 line-through"
                              : "bg-primary/10 text-primary"
                            }
                          `}
                        >
                          {topic}
                        </div>
                      ))}
                      {studyDay.topics.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{studyDay.topics.length - 2} more</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="animate-fade-in glass-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-bold text-primary">Day {selectedDay.day}</span>
                <span className="text-xs text-muted-foreground">{selectedDay.date}</span>
                <span className="text-xs text-muted-foreground">{selectedDay.estimated_minutes} min</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedDay.topics.map((topic, i) => (
                  <span key={i} className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <Button
              variant={completed.has(selectedDay.day) ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleComplete(selectedDay.day)}
            >
              {completed.has(selectedDay.day) ? "Completed" : "Mark Done"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
