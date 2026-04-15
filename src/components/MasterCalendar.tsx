import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface MasterStudyDay {
  date: string;
  subject: string;
  uploadId: string;
  topics: string[];
  estimated_minutes: number;
}

export function MasterCalendar({ days, onOpenStudy }: {
  days: MasterStudyDay[];
  onOpenStudy: (uploadId: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const dateMap = useMemo(() => {
    const map = new Map<string, MasterStudyDay[]>();
    days.forEach((d) => {
      const existing = map.get(d.date) || [];
      existing.push(d);
      map.set(d.date, existing);
    });
    return map;
  }, [days]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calDays: Date[] = [];
  let d = calStart;
  while (d <= calEnd) { calDays.push(d); d = addDays(d, 1); }

  const weeks: Date[][] = [];
  for (let i = 0; i < calDays.length; i += 7) weeks.push(calDays.slice(i, i + 7));

  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const selectedDayEntries = selectedDate ? (dateMap.get(selectedDate) || []) : [];

  // Color palette for subjects
  const subjectColors = useMemo(() => {
    const colors = [
      "bg-primary/10 text-primary",
      "bg-emerald-500/10 text-emerald-400",
      "bg-amber-500/10 text-amber-400",
      "bg-violet-500/10 text-violet-400",
      "bg-rose-500/10 text-rose-400",
    ];
    const subjects = [...new Set(days.map((d) => d.subject))];
    const map = new Map<string, string>();
    subjects.forEach((s, i) => map.set(s, colors[i % colors.length]));
    return map;
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</h3>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 bg-secondary/50">
          {weekDayLabels.map((wd) => (
            <div key={wd} className="py-2 text-center text-xs font-medium text-muted-foreground">{wd}</div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-t border-border">
            {week.map((date, di) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const entries = dateMap.get(dateStr);
              const inMonth = isSameMonth(date, currentMonth);
              const today = isToday(date);

              return (
                <button
                  key={di}
                  onClick={() => { if (entries?.length) { setSelectedDate(dateStr); setDialogOpen(true); } }}
                  className={`relative min-h-[72px] border-r border-border p-1.5 text-left transition-all duration-150 last:border-r-0
                    ${!inMonth ? "bg-secondary/20" : entries?.length ? "hover:bg-secondary/40 cursor-pointer" : ""}
                    ${today ? "bg-primary/5" : ""}
                  `}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs
                    ${today ? "bg-primary text-primary-foreground font-bold" : inMonth ? "text-foreground" : "text-muted-foreground/40"}
                  `}>
                    {format(date, "d")}
                  </span>

                  {entries && inMonth && (
                    <div className="mt-0.5 space-y-0.5">
                      {entries.slice(0, 2).map((entry, ei) => (
                        <div key={ei} className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium ${subjectColors.get(entry.subject) || "bg-primary/10 text-primary"}`}>
                          {entry.subject}
                        </div>
                      ))}
                      {entries.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{entries.length - 2} more</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedDayEntries.map((entry, i) => (
              <button
                key={i}
                onClick={() => { setDialogOpen(false); onOpenStudy(entry.uploadId); }}
                className="w-full rounded-xl border border-border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{entry.subject}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {entry.estimated_minutes} min
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {entry.topics.map((t, ti) => (
                    <span key={ti} className={`rounded px-2 py-0.5 text-[11px] font-medium ${subjectColors.get(entry.subject) || "bg-primary/10 text-primary"}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
